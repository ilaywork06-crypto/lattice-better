import { cva, type VariantProps } from 'class-variance-authority'
import { Loader2 } from 'lucide-react'
import { Slot } from 'radix-ui'
import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all select-none ' +
    'disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring ' +
    '[&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.98]',
  {
    variants: {
      variant: {
        primary: 'bg-primary text-primary-foreground shadow-soft hover:brightness-110',
        secondary: 'bg-card text-foreground border border-border shadow-soft hover:bg-muted',
        soft: 'bg-primary-soft text-primary-soft-foreground hover:brightness-[0.97] dark:hover:brightness-110',
        ghost: 'text-foreground hover:bg-muted',
        outline: 'border border-input bg-transparent hover:bg-muted',
        danger: 'bg-danger text-white shadow-soft hover:brightness-110',
        'danger-soft': 'bg-danger-soft text-danger hover:brightness-[0.97] dark:hover:brightness-110',
        link: 'text-primary underline-offset-4 hover:underline px-0 h-auto',
      },
      size: {
        sm: 'h-8 px-3 text-[13px]',
        md: 'h-9 px-4',
        lg: 'h-11 px-5 text-[15px]',
        icon: 'size-9',
        'icon-sm': 'size-8',
      },
    },
    defaultVariants: { variant: 'secondary', size: 'md' },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
  loading?: boolean
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild, loading, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot.Root : 'button'
    return (
      <Comp
        ref={ref}
        className={cn(buttonVariants({ variant, size }), className)}
        disabled={disabled || loading}
        {...props}
      >
        {asChild ? children : (
          <>
            {loading && <Loader2 className="animate-spin" />}
            {children}
          </>
        )}
      </Comp>
    )
  },
)
Button.displayName = 'Button'
