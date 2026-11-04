import createClient from 'openapi-fetch'
import type { components, paths } from './schema'

export type Problem = components['schemas']['Problem']
export type Schema = components['schemas']

export class ApiError extends Error {
  status: number
  problem: Problem
  constructor(status: number, problem: Problem) {
    super(problem.detail || problem.title || `HTTP ${status}`)
    this.name = 'ApiError'
    this.status = status
    this.problem = problem
  }
}

type ApiResult<T> = {
  data?: T
  error?: unknown
  response: Response
}

export const client = createClient<paths>({
  baseUrl: '/api/v1',
  credentials: 'include',
})

function csrfToken(): string {
  const match = document.cookie.match(/(?:^|; )t4c_csrf=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : ''
}

client.use({
  onRequest({ request }) {
    const method = request.method.toUpperCase()
    if (!['GET', 'HEAD', 'OPTIONS'].includes(method)) {
      const token = csrfToken()
      if (token) request.headers.set('X-CSRF-Token', token)
    }
    return request
  },
})

let refreshing: Promise<boolean> | null = null

async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = fetch('/api/v1/auth/refresh', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
    })
      .then((response) => response.ok)
      .catch(() => false)
      .finally(() => {
        refreshing = null
      })
  }
  return refreshing
}

function problemFrom(error: unknown, response: Response): Problem {
  if (error && typeof error === 'object' && Object.keys(error as object).length > 0) return error as Problem
  const title =
    response.status >= 500
      ? 'T4C service is temporarily unavailable. Please try again shortly.'
      : response.statusText || 'Request failed'
  return { status: response.status, title }
}

export async function execute<T>(operation: () => Promise<ApiResult<T>>, allowRefresh = true): Promise<T> {
  let result: ApiResult<T>
  try {
    result = await operation()
  } catch (error) {
    if (error instanceof ApiError) throw error
    // The request never reached the server (offline, restart window, proxy 502).
    throw new ApiError(0, {
      status: 0,
      title: 'T4C service is unreachable',
      detail: 'The request could not reach the server. The service may be restarting — please try again in a moment.',
    })
  }
  if (result.response.status === 401 && allowRefresh) {
    if (await refreshSession()) result = await operation()
  }
  if (!result.response.ok || result.error) {
    if (result.response.status === 401) window.dispatchEvent(new CustomEvent('t4c:unauthorized'))
    throw new ApiError(result.response.status, problemFrom(result.error, result.response))
  }
  return (result.data ?? ({} as T)) as T
}

export async function download(url: string) {
  const response = await fetch(url, { credentials: 'include' })
  if (!response.ok) throw new ApiError(response.status, { title: 'Download failed', status: response.status })
  const blob = await response.blob()
  const href = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = href
  anchor.download = url.split('/').pop() || 'download'
  anchor.click()
  URL.revokeObjectURL(href)
}
