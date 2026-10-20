// GET /api/conversations - Load user conversations
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffiwqkvftwosybubnerh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_t__IyaSL9g4v0HNNZjFk9Q_te0hZnos';

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    try {
        const convRes = await fetch(
            `${SUPABASE_URL}/rest/v1/conversations?select=id,title,updated_at&order=updated_at.desc`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        const conversations = await convRes.json();

        return res.status(200).json({
            success: true,
            conversations: conversations || []
        });
    } catch (err) {
        return res.status(500).json({ error: 'Error del servidor' });
    }
}