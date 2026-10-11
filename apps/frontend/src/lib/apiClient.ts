export interface ApiRequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: HeadersInit
  token?: string
}

interface ApiErrorBody {
  error?: {
    code?: unknown
    message?: unknown
  }
}

export class ApiClientError extends Error {
  public readonly status: number
  public readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
    this.name = 'ApiClientError'
  }
}

function requestUrl(path: string): string {
  const baseUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  const endpoint = path.startsWith('/') ? path : `/${path}`
  if (!baseUrl) return endpoint

  const base = new URL(baseUrl)
  const basePath = base.pathname.replace(/\/+$/, '')
  const endpointUrl = new URL(endpoint, 'http://api-request.invalid')
  const endpointPath = basePath.endsWith('/api') && endpointUrl.pathname.startsWith('/api/')
    ? endpointUrl.pathname.slice(4)
    : endpointUrl.pathname
  base.pathname = `${basePath}${endpointPath}` || '/'
  base.search = endpointUrl.search
  base.hash = endpointUrl.hash
  return base.toString()
}

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { token, headers: requestHeaders, ...requestOptions } = options
  const headers = new Headers(requestHeaders)
  if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
  if (token) headers.set('Authorization', `Bearer ${token}`)

  const response = await fetch(requestUrl(path), { ...requestOptions, headers })
  if (response.status === 204) return undefined as T

  if (!response.ok) {
    const parsed: unknown = await response.json().catch(() => null)
    const body = typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? parsed as ApiErrorBody
      : {}
    const envelope = typeof body.error === 'object' && body.error !== null && !Array.isArray(body.error)
      ? body.error
      : undefined
    const code = typeof envelope?.code === 'string' ? envelope.code : 'INTERNAL_ERROR'
    const message = typeof envelope?.message === 'string' ? envelope.message : 'Request failed'
    throw new ApiClientError(response.status, code, message)
  }

  return await response.json() as T
}
