import { useId, type InputHTMLAttributes } from 'react'
import { cn } from './cn'

interface FieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label:        string
  description?: string
  error?:       string | null
}

/**
 * Champ de formulaire : libellé visible, aide et erreur reliées au champ,
 * de sorte qu'un lecteur d'écran les annonce en même temps que lui.
 */
export function Field({ label, description, error, className, id, ...props }: FieldProps) {
  const autoId = useId()
  const inputId = id ?? autoId
  const descId  = `${inputId}-desc`
  const errId   = `${inputId}-err`
  const describedBy = [description && descId, error && errId].filter(Boolean).join(' ') || undefined

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-fg">{label}</label>
      <input
        id={inputId}
        aria-describedby={describedBy}
        aria-invalid={error ? true : undefined}
        className={cn(
          'h-10 rounded-control border bg-bg px-3 text-sm text-fg placeholder:text-fg-subtle',
          'transition-colors duration-150 focus:outline-none focus-visible:outline-2 focus-visible:outline-accent',
          error ? 'border-danger' : 'border-line hover:border-line-strong',
          className,
        )}
        {...props}
      />
      {description && <p id={descId} className="text-xs text-fg-subtle">{description}</p>}
      {error && <p id={errId} role="alert" className="text-xs text-danger">{error}</p>}
    </div>
  )
}
