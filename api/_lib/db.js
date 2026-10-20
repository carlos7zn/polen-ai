// Acceso a Supabase (PostgREST) desde el servidor con la clave service_role.
const SUPABASE_URL = (process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

export function dbConfigured() {
    return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

function headers(extra = {}) {
    const h = { 'Content-Type': 'application/json', apikey: SUPABASE_KEY, ...extra };
    // Las claves antiguas (JWT, empiezan por "eyJ") van tambien en Authorization.
    // Las nuevas (sb_secret_...) solo van en apikey.
    if (SUPABASE_KEY.startsWith('eyJ')) h.Authorization = `Bearer ${SUPABASE_KEY}`;
    return h;
}

export async function db(path, { method = 'GET', body, returning = false } = {}) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        method,
        headers: headers(returning ? { Prefer: 'return=representation' } : {}),
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = null; }
    return { ok: res.ok, status: res.status, data };
}
