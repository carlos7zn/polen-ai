// POST /api/chat - Main chat endpoint
import crypto from 'crypto';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ffiwqkvftwosybubnerh.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_t__IyaSL9g4v0HNNZjFk9Q_te0hZnos';
const OPENROUTER_URL = process.env.OPENROUTER_URL || 'http://localhost:3001/v1/chat/completions';

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Método no permitido' });
    }

    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'No autorizado' });
    }

    const token = authHeader.slice(7);
    const { conversationId, message } = req.body;

    if (!message) {
        return res.status(400).json({ error: 'Message requerido' });
    }

    try {
        // Get user from token (simple lookup - in production use JWT)
        // For now, we trust the token and look up conversations
        let messages = [];
        let convId = conversationId;

        if (convId) {
            const convRes = await fetch(
                `${SUPABASE_URL}/rest/v1/conversations?id=eq.${convId}&select=messages`,
                {
                    headers: {
                        'apikey': SUPABASE_ANON_KEY,
                        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                    }
                }
            );
            const convData = await convRes.json();
            if (convData.length > 0) {
                messages = convData[0].messages || [];
            }
        }

        // Add user message
        messages.push({ role: 'user', content: message });

        // Call AI (OpenRouter or local proxy)
        const aiRes = await fetch(OPENROUTER_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY || 'local'}`
            },
            body: JSON.stringify({
                model: process.env.AI_MODEL || 'mistralai/mistral-7b-instruct:free',
                messages: messages,
                stream: true
            })
        });

        if (!aiRes.ok) {
            const errText = await aiRes.text();
            return res.status(500).json({ error: 'Error de IA: ' + errText });
        }

        // Set up streaming response
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const reader = aiRes.body.getReader();
        const decoder = new TextDecoder();
        let assistantText = '';

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            const chunk = decoder.decode(value, { stream: true });
            const lines = chunk.split('\n');

            for (const line of lines) {
                if (line.startsWith('data: ')) {
                    const data = line.slice(6);
                    if (data === '[DONE]') continue;

                    try {
                        const parsed = JSON.parse(data);
                        if (parsed.choices?.[0]?.delta?.content) {
                            assistantText += parsed.choices[0].delta.content;
                            res.write(`data: ${JSON.stringify({ content: parsed.choices[0].delta.content })}\n\n`);
                        }
                    } catch (e) { /* skip */ }
                }
            }
        }

        // Save conversation
        messages.push({ role: 'assistant', content: assistantText });

        if (convId) {
            await fetch(`${SUPABASE_URL}/rest/v1/conversations?id=eq.${convId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
                },
                body: JSON.stringify({
                    messages,
                    title: messages[0].content.substring(0, 50)
                })
            });
        } else {
            // Create new conversation
            const newConvRes = await fetch(`${SUPABASE_URL}/rest/v1/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'apikey': SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
                    'Prefer': 'return=representation'
                },
                body: JSON.stringify({
                    messages,
                    title: messages[0].content.substring(0, 50)
                })
            });
            const newConv = await newConvRes.json();
            if (newConv[0]) {
                res.write(`data: ${JSON.stringify({ conversationId: newConv[0].id })}\n\n`);
            }
        }

        res.write('data: [DONE]\n\n');
        res.end();
    } catch (err) {
        res.status(500).json({ error: 'Error del servidor: ' + err.message });
    }
}