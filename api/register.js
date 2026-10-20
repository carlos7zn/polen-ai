// POST /api/register
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffiwqkvftwosybubnerh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_t__IyaSL9g4v0HNNZjFk9Q_te0hZnos';

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const { email, password, display_name } = req.body;

    if (!email || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    if (password.length < 6) {
        return res.status(400).json({ error: 'La contraseña debe tener al menos 6 caracteres' });
    }

    const password_hash = crypto.createHash('sha256').update(password).digest('hex');

    try {
        const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/users`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                'Prefer': 'return=representation'
            },
            body: JSON.stringify({
                email,
                password_hash,
                display_name: display_name || email.split('@')[0]
            })
        });

        const supabaseData = await supabaseRes.json();

        if (!supabaseRes.ok) {
            console.error('Supabase register error:', supabaseRes.status, supabaseData);
            return res.status(supabaseRes.status).json({
                error: supabaseData.message || supabaseData.details || supabaseData.hint || 'Error al registrar en base de datos',
                details: supabaseData
            });
        }

        const user = supabaseData[0];
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
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Error del servidor: ' + err.message });
    }
}