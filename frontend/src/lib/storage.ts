/** localStorage that never throws (private windows, blocked storage). */
export const store = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(`lattice.${key}`)
    } catch {
      return null
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) localStorage.removeItem(`lattice.${key}`)
      else localStorage.setItem(`lattice.${key}`, value)
    } catch {
      /* ignore */
    }
  },
}
