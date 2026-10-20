// POST /api/chat  { conversationId?, message }  -> respuesta en streaming (SSE)
// El LLM es cualquier endpoint compatible con OpenAI (FreeLLMAPI, Hermes, OpenRouter...).
import { db, dbConfigured } from './_lib/db.js';
import { getUser } from './_lib/auth.js';

const LLM_BASE_URL = (process.env.LLM_BASE_URL || 'https://openrouter.ai/api/v1').replace(/\/+$/, '');
const LLM_API_KEY = process.env.LLM_API_KEY || process.env.OPENROUTER_API_KEY || '';
const LLM_MODEL = process.env.LLM_MODEL || process.env.AI_MODEL || 'mistralai/mistral-7b-instruct:free';
const SYSTEM_PROMPT = process.env.SYSTEM_PROMPT || 'Eres PolenAI, un asistente útil y amable. Responde en el idioma del usuario.';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_MESSAGE_CHARS = 4000;
const CONTEXT_MESSAGES = 30; // cuantos mensajes previos se envian al modelo

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Método no permitido' });
    if (!dbConfigured()) return res.status(500).json({ error: 'Servidor sin configurar' });

    const user = getUser(req);
    if (!user) return res.status(401).json({ error: 'No autorizado' });

    const { conversationId, message } = req.body || {};
    if (typeof message !== 'string' || !message.trim()) {
        return res.status(400).json({ error: 'Message requerido' });
    }
    if (message.length > MAX_MESSAGE_CHARS) {
        return res.status(400).json({ error: `El mensaje es demasiado largo (máx. ${MAX_MESSAGE_CHARS} caracteres)` });
    }
    if (conversationId && !UUID_RE.test(conversationId)) {
        return res.status(400).json({ error: 'conversationId no válido' });
    }

    try {
        // 1) Cargar historial (solo si la conversación es del usuario)
        let messages = [];
        let convId = null;
        if (conversationId) {
            const r = await db(`conversations?id=eq.${conversationId}&user_id=eq.${user.id}&select=id,messages&limit=1`);
            const conv = r.ok && Array.isArray(r.data) ? r.data[0] : null;
            if (!conv) return res.status(404).json({ error: 'Conversación no encontrada' });
            convId = conv.id;
            messages = Array.isArray(conv.messages) ? conv.messages : [];
        }
        messages.push({ role: 'user', content: message.trim() });

        // 2) Llamar al LLM
        const controller = new AbortController();
        res.on('close', () => controller.abort());

        let aiRes;
        try {
            aiRes = await fetch(`${LLM_BASE_URL}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(LLM_API_KEY ? { Authorization: `Bearer ${LLM_API_KEY}` } : {}),
                    'HTTP-Referer': 'https://polen-ai.vercel.app',
                    'X-Title': 'PolenAI',
                },
                body: JSON.stringify({
                    model: LLM_MODEL,
                    stream: true,
                    messages: [{ role: 'system', content: SYSTEM_PROMPT }, ...messages.slice(-CONTEXT_MESSAGES)],
                }),
                signal: controller.signal,
            });
        } catch (err) {
            console.error('LLM connection error:', err);
            return res.status(502).json({ error: 'No se pudo conectar con la IA. ¿Está encendido el servidor del modelo?' });
        }

        if (!aiRes.ok || !aiRes.body) {
            console.error('LLM error:', aiRes.status, (await aiRes.text().catch(() => '')).slice(0, 500));
            return res.status(502).json({ error: `La IA respondió con error (${aiRes.status})` });
        }

        // 3) Reenviar el stream al navegador
        res.writeHead(200, {
            'Content-Type': 'text/event-stream; charset=utf-8',
            'Cache-Control': 'no-cache, no-transform',
            Connection: 'keep-alive',
            'X-Accel-Buffering': 'no',
        });

        const decoder = new TextDecoder();
        let buffer = '';
        let assistantText = '';

        try {
            for await (const chunk of aiRes.body) {
                buffer += decoder.decode(chunk, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();
                for (const raw of lines) {
                    const line = raw.trim();
                    if (!line.startsWith('data:')) continue;
                    const data = line.slice(5).trim();
                    if (!data || data === '[DONE]') continue;
                    try {
                        const delta = JSON.parse(data).choices?.[0]?.delta?.content;
                        if (delta) {
                            assistantText += delta;
                            res.write(`data: ${JSON.stringify({ content: delta })}\n\n`);
                        }
                    } catch { /* linea incompleta */ }
                }
            }
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.error('Stream error:', err);
                res.write(`data: ${JSON.stringify({ error: 'La respuesta se interrumpió' })}\n\n`);
            }
        }

        // 4) Guardar la conversación
        if (assistantText) {
            messages.push({ role: 'assistant', content: assistantText });
            const title = messages[0].content.substring(0, 50);
            if (convId) {
                await db(`conversations?id=eq.${convId}&user_id=eq.${user.id}`, {
                    method: 'PATCH',
                    body: { messages },
                });
            } else {
                const created = await db('conversations', {
                    method: 'POST',
                    returning: true,
                    body: { user_id: user.id, title, messages },
                });
                if (created.ok && created.data?.[0]) {
                    res.write(`data: ${JSON.stringify({ conversationId: created.data[0].id })}\n\n`);
                } else {
                    console.error('No se pudo guardar la conversación:', created.status, created.data);
                }
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        console.error('Chat error:', err);
        if (!res.headersSent) return res.status(500).json({ error: 'Error del servidor' });
        res.end();
    }
}
