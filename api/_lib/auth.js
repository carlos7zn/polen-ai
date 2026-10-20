// Contraseñas (scrypt + sal) y sesiones firmadas (JWT HS256) sin dependencias externas.
import crypto from 'crypto';

const SECRET = process.env.AUTH_SECRET || '';
const TOKEN_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 dias

export function authConfigured() {
    return SECRET.length >= 32;
}

// ---------- contraseñas ----------
export function hashPassword(password) {
    const salt = crypto.randomBytes(16);
    const hash = crypto.scryptSync(password, salt, 64);
    return `scrypt$${salt.toString('hex')}$${hash.toString('hex')}`;
}

export function verifyPassword(password, stored) {
    try {
        const [scheme, saltHex, hashHex] = String(stored).split('$');
        if (scheme !== 'scrypt') return false;
        const expected = Buffer.from(hashHex, 'hex');
        const actual = crypto.scryptSync(password, Buffer.from(saltHex, 'hex'), expected.length);
        return crypto.timingSafeEqual(actual, expected);
    } catch {
        return false;
    }
}

// ---------- tokens ----------
const b64 = (buf) => Buffer.from(buf).toString('base64url');

export function signToken(user) {
    const header = b64(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
    const payload = b64(JSON.stringify({
        sub: user.id,
        email: user.email,
        exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
    }));
    const sig = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest('base64url');
    return `${header}.${payload}.${sig}`;
}

export function verifyToken(token) {
    try {
        if (!authConfigured()) return null;
        const [header, payload, sig] = String(token).split('.');
        if (!header || !payload || !sig) return null;
        const expected = crypto.createHmac('sha256', SECRET).update(`${header}.${payload}`).digest();
        const given = Buffer.from(sig, 'base64url');
        if (given.length !== expected.length || !crypto.timingSafeEqual(given, expected)) return null;
        const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
        if (!data.sub || !data.exp || data.exp < Math.floor(Date.now() / 1000)) return null;
        return data;
    } catch {
        return null;
    }
}

// Devuelve { id, email } si la peticion trae un token valido; si no, null.
export function getUser(req) {
    const h = req.headers.authorization || '';
    if (!h.startsWith('Bearer ')) return null;
    const data = verifyToken(h.slice(7));
    return data ? { id: data.sub, email: data.email } : null;
}
