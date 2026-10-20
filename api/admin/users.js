// GET /api/admin/users - Admin only: list all users with stats
import { db, dbConfigured } from './_lib/db.js';
import { getUser } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured()) return res.status(500).json({ error: 'Servidor sin configurar' });

    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });
    if (!user.is_admin) return res.status(403).json({ error: 'Acceso denegado: solo administradores' });

    try {
        // Get all users with stats
        const r = await db(`users?select=id,email,display_name,plan,message_count,token_count,is_admin,last_active_at,created_at&order=created_at.desc&limit=1000`);
        const users = r.ok && Array.isArray(r.data) ? r.data : [];

        // Get conversation counts for all users
        const convR = await db(`conversations?select=user_id,id&limit=5000`);
        const convMap = {};
        if (convR.ok && Array.isArray(convR.data)) {
            for (const c of convR.data) {
                convMap[c.user_id] = (convMap[c.user_id] || 0) + 1;
            }
        }

        // Get message counts per user (recent)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const recentR = await db(`conversations?updated_at=gte.${weekAgo}&select=user_id,messages,updated_at&limit=5000`);
        const recentMsgMap = {};
        if (recentR.ok && Array.isArray(recentR.data)) {
            for (const c of recentR.data) {
                const msgs = Array.isArray(c.messages) ? c.messages.length : 0;
                recentMsgMap[c.user_id] = (recentMsgMap[c.user_id] || 0) + msgs;
            }
        }

        const usersWithStats = users.map(u => ({
            id: u.id,
            email: u.email,
            display_name: u.display_name,
            plan: u.plan,
            message_count: u.message_count,
            token_count: u.token_count,
            is_admin: u.is_admin,
            last_active_at: u.last_active_at,
            created_at: u.created_at,
            conversations_total: convMap[u.id] || 0,
            messages_last_7_days: recentMsgMap[u.id] || 0,
        }));

        return res.status(200).json({
            success: true,
            users: usersWithStats,
            total: usersWithStats.length,
        });
    } catch (err) {
        console.error('Admin users error:', err);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}