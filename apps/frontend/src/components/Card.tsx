import type { ComponentPropsWithRef } from 'react'
import { classNames } from './class-names'
import './Card.css'

export interface CardProps extends ComponentPropsWithRef<'div'> {
  padding?: 'none' | 'sm' | 'md'
}

// White rounded container used for carpark list items and detail tiles.
// For a "TOTAL SPOTS / 120" style tile, put a <span className="sp-label"> above the value.
export function Card({ padding = 'md', className, ...rest }: CardProps) {
  return <div className={classNames('sp-card', `sp-card--pad-${padding}`, className)} {...rest} />
}
