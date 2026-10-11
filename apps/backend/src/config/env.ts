export interface BackendEnv {
  supabaseUrl: string
  supabaseServiceRoleKey: string
  port: number
  frontendOrigin: string
}

export function loadEnv(source: Record<string, string | undefined>): BackendEnv {
  const supabaseUrl = source.SUPABASE_URL?.trim()
  if (!supabaseUrl) throw new Error('SUPABASE_URL is required')

  const supabaseServiceRoleKey = source.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!supabaseServiceRoleKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is required')

  const portValue = source.PORT === undefined ? '4000' : source.PORT.trim()
  const port = Number(portValue)
  if (!/^\d+$/.test(portValue) || !Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error('PORT must be an integer from 1 to 65535')
  }

  const frontendOrigin = source.FRONTEND_ORIGIN?.trim() ?? 'http://localhost:5173'
  try {
    const url = new URL(frontendOrigin)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== frontendOrigin) throw new Error()
  } catch {
    throw new Error('FRONTEND_ORIGIN must be an HTTP(S) origin without a path or trailing slash')
  }

  return { supabaseUrl, supabaseServiceRoleKey, port, frontendOrigin }
}
