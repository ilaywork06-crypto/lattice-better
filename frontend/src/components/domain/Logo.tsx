import { cn } from '@/lib/cn'

/** The Lattice mark: a grid with one highlighted path through it. */
export function Logo({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" className={cn('shrink-0', className)} aria-hidden>
      <defs>
        <linearGradient id="lattice-g" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="var(--primary)" />
          <stop offset="1" stopColor="color-mix(in oklch, var(--primary), black 25%)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill="url(#lattice-g)" />
      <g fill="none" stroke="#fff" strokeLinecap="round">
        <path d="M9 9h14M9 16h14M9 23h14M9 9v14M16 9v14M23 9v14" strokeWidth="1.6" opacity=".35" />
        <path d="M9 9l7 7 7 7" strokeWidth="2.4" />
      </g>
      <g fill="#fff">
        <circle cx="9" cy="9" r="2.6" />
        <circle cx="16" cy="16" r="2.6" />
        <circle cx="23" cy="23" r="2.6" />
      </g>
    </svg>
  )
}
