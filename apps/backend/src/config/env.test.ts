import { describe, expect, it } from 'vitest'
import { loadEnv } from './env.js'

const validSource = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'service-role-key',
}

describe('loadEnv', () => {
  it('rejects missing Supabase configuration', () => {
    expect(() => loadEnv({ PORT: '4000' })).toThrow('SUPABASE_URL')
    expect(() => loadEnv({ SUPABASE_URL: validSource.SUPABASE_URL })).toThrow(
      'SUPABASE_SERVICE_ROLE_KEY',
    )
  })

  it('trims configuration values and parses a valid port', () => {
    expect(
      loadEnv({
        SUPABASE_URL: `  ${validSource.SUPABASE_URL}  `,
        SUPABASE_SERVICE_ROLE_KEY: `  ${validSource.SUPABASE_SERVICE_ROLE_KEY}  `,
        PORT: ' 4000 ',
      }),
    ).toEqual({
      supabaseUrl: validSource.SUPABASE_URL,
      supabaseServiceRoleKey: validSource.SUPABASE_SERVICE_ROLE_KEY,
      port: 4000,
      frontendOrigin: 'http://localhost:5173',
    })
  })

  it.each(['0', '65536', '3.5', '4000abc', ''])('rejects invalid port %j', (port) => {
    expect(() => loadEnv({ ...validSource, PORT: port })).toThrow('PORT')
  })

  it('defaults to port 4000 when PORT is absent', () => {
    expect(loadEnv(validSource).port).toBe(4000)
  })

  it('accepts a trimmed frontend origin', () => {
    expect(loadEnv({ ...validSource, FRONTEND_ORIGIN: ' https://parking.example ' }).frontendOrigin).toBe('https://parking.example')
  })

  it.each(['', '*', 'null', 'not-a-url', 'ftp://parking.example', 'https://parking.example/path', 'https://user:pass@parking.example', 'https://parking.example?x=1'])('rejects invalid frontend origin %j', (origin) => {
    expect(() => loadEnv({ ...validSource, FRONTEND_ORIGIN: origin })).toThrow('FRONTEND_ORIGIN')
  })
})
