import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'
type Size = 'small' | 'medium'

const variantClasses: Record<Variant, string> = {
  primary: 'border-accent bg-accent text-white hover:bg-blue-700',
  secondary: 'border-line bg-surface text-ink hover:bg-subtle',
  ghost: 'border-transparent text-muted hover:bg-subtle hover:text-ink',
  danger: 'border-line bg-surface text-danger hover:bg-red-50',
}

const sizeClasses: Record<Size, string> = {
  small: 'h-7 px-2 text-caption',
  medium: 'h-8 px-3 text-body',
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }

export function Button({ variant = 'secondary', size = 'medium', className = '', type = 'button', ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={`inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded border transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
      {...props}
    />
  )
}
