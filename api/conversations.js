// GET /api/conversations            -> lista de MIS conversaciones
// GET /api/conversations?id=<uuid>  -> una conversación mía con sus mensajes
import { db, dbConfigured } from './_lib/db.js';
import { getUser } from './_lib/auth.js';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured()) return res.status(500).json({ error: 'Servidor sin configurar' });

    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    try {
        const id = req.query?.id;
        if (id) {
            if (!UUID_RE.test(id)) return res.status(400).json({ error: 'id no válido' });
            const r = await db(`conversations?id=eq.${id}&user_id=eq.${user.id}&select=id,title,messages,updated_at&limit=1`);
            const conv = r.ok && Array.isArray(r.data) ? r.data[0] : null;
            if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
            return res.status(200).json({ success: true, conversation: conv });
        }

        const r = await db(`conversations?user_id=eq.${user.id}&select=id,title,updated_at&order=updated_at.desc&limit=100`);
        if (!r.ok) {
            console.error('Conversations DB error:', r.status, r.data);
            return res.status(500).json({ error: 'Error al cargar conversaciones' });
        }
        return res.status(200).json({ success: true, conversations: r.data || [] });
    } catch (err) {
        console.error('Conversations error:', err);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}
