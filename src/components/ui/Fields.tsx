import {
  useId,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react'

interface FieldShellProps {
  id: string
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: ReactNode
}

function FieldShell({ id, label, required, error, hint, children }: FieldShellProps) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
        {required && (
          <span className="ml-0.5 text-red-500" aria-hidden>
            *
          </span>
        )}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : hint ? (
        <p id={`${id}-hint`} className="mt-1 text-xs text-slate-500">
          {hint}
        </p>
      ) : null}
    </div>
  )
}

interface CommonProps {
  label: string
  error?: string
  hint?: string
}

function describedBy(id: string, error?: string, hint?: string) {
  if (error) return `${id}-error`
  if (hint) return `${id}-hint`
  return undefined
}

export function TextField({
  label,
  error,
  hint,
  className = '',
  ...rest
}: CommonProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={rest.required} error={error} hint={hint}>
      <input
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={`input-base ${error ? 'input-error' : ''} ${className}`}
        {...rest}
        // We show our own messages, so the browser's pop-ups stay out of the way.
        required={false}
      />
    </FieldShell>
  )
}

export function SelectField({
  label,
  error,
  hint,
  className = '',
  children,
  ...rest
}: CommonProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={rest.required} error={error} hint={hint}>
      <select
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={`input-base ${error ? 'input-error' : ''} ${className}`}
        {...rest}
        required={false}
      >
        {children}
      </select>
    </FieldShell>
  )
}

export function TextareaField({
  label,
  error,
  hint,
  className = '',
  ...rest
}: CommonProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId()
  return (
    <FieldShell id={id} label={label} required={rest.required} error={error} hint={hint}>
      <textarea
        id={id}
        aria-invalid={Boolean(error)}
        aria-describedby={describedBy(id, error, hint)}
        className={`input-base ${error ? 'input-error' : ''} ${className}`}
        {...rest}
        required={false}
      />
    </FieldShell>
  )
}
