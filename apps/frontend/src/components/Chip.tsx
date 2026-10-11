import type { ComponentPropsWithRef } from 'react'
import { classNames } from './class-names'
import './Chip.css'

export interface ChipProps extends ComponentPropsWithRef<'button'> {
  /** Toggle chips: whether the filter is active. Ignored when `expanded` is set. */
  selected?: boolean
  /** Menu chips: pass whether the chip's dropdown is open. Shows a caret and sets aria-expanded. */
  expanded?: boolean
}

// Shell only: filter-specific behaviour (options menus, combining filters) lives in
// features/carparks/filters/ (Xi Fei).
export function Chip({ selected = false, expanded, type = 'button', className, children, ...rest }: ChipProps) {
  const hasMenu = expanded !== undefined
  return (
    <button
      type={type}
      className={classNames('sp-chip', (selected || expanded) && 'sp-chip--active', className)}
      aria-pressed={hasMenu ? undefined : selected}
      aria-haspopup={hasMenu ? 'true' : undefined}
      aria-expanded={hasMenu ? expanded : undefined}
      {...rest}
    >
      {children}
      {hasMenu && (
        <svg className="sp-chip__caret" width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M2 3.5 5 6.5 8 3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      )}
    </button>
  )
}
