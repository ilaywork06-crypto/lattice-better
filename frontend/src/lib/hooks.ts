import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'

export function useDebounced<T>(value: T, ms = 250): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setV(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return v
}

/** A piece of state kept in the URL (?key=value), so views can be linked to. */
export function useUrlState(key: string, fallback = ''): [string, (v: string) => void] {
  const [params, setParams] = useSearchParams()
  const value = params.get(key) ?? fallback
  const set = (v: string) =>
    setParams(
      () => {
        // Start from the live URL, not react-router's render-time `prev`, so that
        // several setters called in one handler compose instead of overwriting.
        const next = new URLSearchParams(window.location.search)
        if (!v || v === fallback) next.delete(key)
        else next.set(key, v)
        return next
      },
      { replace: true },
    )
  return [value, set]
}
