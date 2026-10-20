// Edge Function for PolenAI API
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const config = {
  runtime: 'edge',
}

export default async function handler(req, res) {
  const { method } = req

  try {
    switch (method) {
      case 'POST':
        // Login o registro
        const body = await req.json()
        const { email, password, action } = body

        if (action === 'login') {
          const { data, error } = await supabase
            .from('users')
            .select('id, email, display_name')
            .eq('email', email)
            .eq('password_hash', createHash('sha256', password).digest('hex'))
            .single()

          if (error || !data) {
            return new Response(JSON.stringify({ error: 'Credenciales incorrectas' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const token = crypto.randomUUID()
          return new Response(JSON.stringify({ success: true, token, user: data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        if (action === 'register') {
          const password_hash = createHash('sha256', password).digest('hex')

          const { data, error } = await supabase
            .from('users')
            .insert({ email, password_hash, display_name: email.split('@')[0] })
            .select('id, email, display_name')
            .single()

          if (error) {
            return new Response(JSON.stringify({ error: error.message }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const token = crypto.randomUUID()
          return new Response(JSON.stringify({ success: true, token, user: data }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        default:
          return new Response(JSON.stringify({ error: 'Método no soportado' }), {
            status: 405,
            headers: { 'Content-Type': 'application/json' },
          })
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Error del servidor' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

// Helper function for sha256
function createHash(algorithm, data) {
  const crypto = require('crypto')
  return crypto.createHash(algorithm, data)
}