const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:8000'

function requestId(): string {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  let id = ''
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  for (const byte of bytes) id += alphabet[byte % alphabet.length]
  return id
}

export class ApiError extends Error {
  code: string
  status: number
  details?: unknown

  constructor(code: string, message: string, status: number, details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
    this.details = details
  }
}

interface ErrorBody {
  error?: {
    code?: string
    message?: string
    details?: unknown
  }
}

async function parseErrorBody(res: Response): Promise<ApiError> {
  let body: ErrorBody | undefined
  try {
    body = await res.json()
  } catch {
  }
  const code = body?.error?.code ?? 'UNKNOWN_ERROR'
  const message = body?.error?.message ?? res.statusText ?? 'Something went wrong.'
  return new ApiError(code, message, res.status, body?.error?.details)
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  raw?: boolean
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, raw, headers, ...rest } = options

  const finalHeaders = new Headers(headers)
  finalHeaders.set('X-Request-ID', requestId())
  if (!raw && body !== undefined) {
    finalHeaders.set('Content-Type', 'application/json')
  }

  let res: Response
  try {
    res = await fetch(`${API_URL}${path}`, {
      ...rest,
      headers: finalHeaders,
      body: body === undefined ? undefined : raw ? (body as BodyInit) : JSON.stringify(body),
    })
  } catch (err) {
    throw new ApiError(
      'NETWORK_ERROR',
      'Could not reach the server. Check your connection and try again.',
      0,
      err,
    )
  }

  if (!res.ok) {
    throw await parseErrorBody(res)
  }

  if (res.status === 204) {
    return undefined as T
  }

  return (await res.json()) as T
}

export const apiClient = {
  get: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'GET' }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'POST', body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    request<T>(path, { ...options, method: 'PATCH', body }),
  delete: <T>(path: string, options?: RequestOptions) => request<T>(path, { ...options, method: 'DELETE' }),
}
