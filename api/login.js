// POST /api/login
import { db, dbConfigured } from './_lib/db.js';
import { verifyPassword, signToken, authConfigured } from './_lib/auth.js';

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured() || !authConfigured()) {
        return res.status(500).json({ error: 'Servidor sin configurar (faltan variables de entorno)' });
    }

    const { email, password } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();
    if (!cleanEmail || typeof password !== 'string' || !password) {
        return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    try {
        const r = await db(`users?email=eq.${encodeURIComponent(cleanEmail)}&select=id,email,display_name,password_hash&limit=1`);
        const user = r.ok && Array.isArray(r.data) ? r.data[0] : null;

        if (!user || !verifyPassword(password, user.password_hash)) {
            return res.status(401).json({ error: 'Credenciales incorrectas' });
        }

        return res.status(200).json({
            success: true,
            token: signToken(user),
            user: { id: user.id, email: user.email, display_name: user.display_name },
        });
    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}
