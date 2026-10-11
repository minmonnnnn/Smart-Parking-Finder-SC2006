import type { ComponentPropsWithRef, ReactNode } from 'react'
import { classNames } from './class-names'
import './Button.css'

export type ButtonVariant = 'primary' | 'secondary' | 'ghost'

export interface ButtonProps extends ComponentPropsWithRef<'button'> {
  /** primary = orange (save/confirm), secondary = blue (navigation actions), ghost = text-only */
  variant?: ButtonVariant
  size?: 'sm' | 'md'
  fullWidth?: boolean
  /** Decorative icon rendered before the label; hidden from screen readers. */
  icon?: ReactNode
}

export function Button({
  variant = 'primary',
  size = 'md',
  fullWidth = false,
  icon,
  type = 'button',
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={classNames('sp-button', `sp-button--${variant}`, `sp-button--${size}`, fullWidth && 'sp-button--full', className)}
      {...rest}
    >
      {icon && <span className="sp-button__icon" aria-hidden="true">{icon}</span>}
      {children}
    </button>
  )
}
