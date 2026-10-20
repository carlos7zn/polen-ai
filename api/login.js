// POST /api/login
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffiwqkvftwosybubnerh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_t__IyaSL9g4v0HNNZjFk9Q_te0hZnos';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const password_hash = crypto.createHash('sha256').update(password).digest('hex');

    try {
        const supabaseRes = await fetch(
            `${SUPABASE_URL}/rest/v1/users?email=eq.${encodeURIComponent(email)}`,
            {
                headers: {
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                }
            }
        );

        const supabaseData = await supabaseRes.json();

        if (!supabaseRes.ok || supabaseData.length === 0) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const user = supabaseData[0];

        if (user.password_hash !== password_hash) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        const token = crypto.randomBytes(32).toString('hex');

        return res.status(200).json({
            success: true,
            token,
            user: {
                id: user.id,
                email: user.email,
                display_name: user.display_name
            }
        });
    } catch (err) {
        return res.status(500).json({ error: 'Error del servidor' });
    }
}