import { store } from '@/lib/storage'

/** One problem pinned to a field, payload key or spreadsheet cell. */
export interface Issue {
  message: string
  field?: string
  label?: string
  sheet?: string
  cell?: string
  row?: number
  column?: string
}

/** Every failed request becomes one of these — the API's error envelope, typed. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly issues: Issue[]

  constructor(status: number, code: string, message: string, issues: Issue[] = []) {
    super(message)
    this.status = status
    this.code = code
    this.issues = issues
  }

  /** The issue for one form field, if any. */
  issueFor(field: string): Issue | undefined {
    return this.issues.find((i) => i.field === field)
  }
}

type Query = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  query?: Query
  json?: unknown
  form?: FormData | URLSearchParams
  signal?: AbortSignal
}

const BASE = '/api/v1'
let unauthorizedHandler: (() => void) | null = null

export const tokenStore = {
  get: () => store.get('token'),
  set: (token: string | null) => store.set('token', token),
}

/** Called (once per burst) when the server says the session is gone. */
export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

export function buildUrl(path: string, query?: Query): string {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query ?? {})) {
    if (v !== undefined && v !== null && v !== '') params.set(k, String(v))
  }
  const qs = params.toString()
  return `${BASE}${path}${qs ? `?${qs}` : ''}`
}

async function send(path: string, opts: RequestOptions): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`
  let body: BodyInit | undefined
  if (opts.json !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(opts.json)
  } else if (opts.form) {
    body = opts.form
  }
  let res: Response
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method: opts.method ?? 'GET', headers, body, signal: opts.signal,
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ApiError(0, 'network', 'Cannot reach the server — check your connection')
  }
  if (!res.ok) {
    let code = 'error'
    let message = res.statusText || `Request failed (${res.status})`
    let issues: Issue[] = []
    try {
      const data = await res.json()
      if (data?.error) {
        code = data.error.code ?? code
        message = data.error.message ?? message
        issues = data.error.issues ?? []
      }
    } catch {
      /* not JSON */
    }
    if (res.status === 401 && token) unauthorizedHandler?.()
    throw new ApiError(res.status, code, message, issues)
  }
  return res
}

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const res = await send(path, opts)
  if (res.status === 204) return undefined as T
  return (await res.json()) as T
}

/** Fetch a file (with the session) and hand it to the browser as a download. */
export async function download(path: string, query?: Query, fallbackName = 'download') {
  const res = await send(path, { query })
  const disposition = res.headers.get('Content-Disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = match?.[1] ?? fallbackName
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Open a stored file in a new tab (images, PDFs) with the session attached. */
export async function openFile(path: string) {
  const res = await send(path, {})
  const url = URL.createObjectURL(await res.blob())
  window.open(url, '_blank', 'noopener')
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
