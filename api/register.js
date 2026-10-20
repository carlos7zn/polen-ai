// POST /api/register
import crypto from 'crypto';
import { db, dbConfigured } from './_lib/db.js';
import { hashPassword, signToken, authConfigured } from './_lib/auth.js';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function sameCode(a, b) {
    const x = Buffer.from(String(a));
    const y = Buffer.from(String(b));
    return x.length === y.length && crypto.timingSafeEqual(x, y);
}

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured() || !authConfigured()) {
        return res.status(500).json({ error: 'Servidor sin configurar (faltan variables de entorno)' });
    }

    const { email, password, display_name, invite_code } = req.body || {};
    const cleanEmail = String(email || '').trim().toLowerCase();

    if (!EMAIL_RE.test(cleanEmail) || cleanEmail.length > 254) {
        return res.status(400).json({ error: 'Email no válido' });
    }
    if (typeof password !== 'string' || password.length < 8 || password.length > 200) {
        return res.status(400).json({ error: 'La contraseña debe tener entre 8 y 200 caracteres' });
    }

    const required = process.env.INVITE_CODE;
    if (required && !sameCode(invite_code || '', required)) {
        return res.status(403).json({ error: 'Código de invitación incorrecto' });
    }

    try {
        const name = String(display_name || '').trim().slice(0, 50) || cleanEmail.split('@')[0];
        const r = await db('users', {
            method: 'POST',
            returning: true,
            body: { email: cleanEmail, password_hash: hashPassword(password), display_name: name },
        });

        if (!r.ok) {
            if (r.status === 409) return res.status(409).json({ error: 'Ese email ya está registrado' });
            console.error('Register DB error:', r.status, r.data);
            return res.status(500).json({ error: 'No se pudo crear la cuenta' });
        }

        const user = r.data[0];
        return res.status(200).json({
            success: true,
            token: signToken(user),
            user: { id: user.id, email: user.email, display_name: user.display_name },
        });
    } catch (err) {
        console.error('Register error:', err);
        return res.status(500).json({ error: 'Error del servidor' });
    }
}
