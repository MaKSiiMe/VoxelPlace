import type { ButtonHTMLAttributes } from 'react'
import { cn } from './cn'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'danger-ghost'
export type ButtonSize    = 'sm' | 'md' | 'lg'

const VARIANTS: Record<ButtonVariant, string> = {
  primary:        'bg-accent text-on-accent hover:brightness-110',
  secondary:      'bg-surface-2 text-fg border border-line hover:border-line-strong hover:bg-line',
  ghost:          'text-fg-muted hover:text-fg hover:bg-surface-2',
  danger:         'bg-danger text-on-accent hover:brightness-110',
  'danger-ghost': 'text-danger hover:bg-danger/10',
}

const SIZES: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  md: 'h-10 px-4 text-sm',
  lg: 'h-12 px-5 text-base',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?:    ButtonSize
}

export function Button({ variant = 'secondary', size = 'md', type = 'button', className, ...props }: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-control font-medium select-none',
        'transition-[background-color,border-color,color,filter] duration-150',
        'disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:brightness-100',
        VARIANTS[variant], SIZES[size], className,
      )}
      {...props}
    />
  )
}
