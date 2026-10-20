// GET /api/profile - Get current user profile with stats
import { db, dbConfigured } from './_lib/db.js';
import { getUser } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured()) return res.status(500).json({ error: 'Servidor sin configurar' });

    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    try {
        // Get user with stats
        const r = await db(`users?id=eq.${user.id}&select=id,email,display_name,plan,message_count,token_count,is_admin,last_active_at,created_at&limit=1`);
        const profile = r.ok && Array.isArray(r.data) ? r.data[0] : null;

        if (!profile) {
            return res.status(404).json({ error: 'Usuario no encontrado' });
        }

        // Get conversation count
        const convCount = await db(`conversations?user_id=eq.${user.id}&select=id&limit=1000`);
        const conversationsTotal = convCount.ok && Array.isArray(convCount.data) ? convCount.data.length : 0;

        // Get recent activity (last 7 days messages)
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
        const recentConv = await db(`conversations?user_id=eq.${user.id}&updated_at=gte.${weekAgo}&select=id,messages,updated_at&limit=50`);
        let recentMessages = 0;
        if (recentConv.ok && Array.isArray(recentConv.data)) {
            for (const c of recentConv.data) {
                recentMessages += Array.isArray(c.messages) ? c.messages.length : 0;
            }
        }

        return res.status(200).json({
            success: true,
            profile: {
                id: profile.id,
                email: profile.email,
                display_name: profile.display_name,
                plan: profile.plan,
                message_count: profile.message_count,
                token_count: profile.token_count,
                is_admin: profile.is_admin,
                last_active_at: profile.last_active_at,
                created_at: profile.created_at,
                conversations_total: conversationsTotal,
                messages_last_7_days: recentMessages,
            }
        });
    } catch (err) {
        console.error('Profile error:', err);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}