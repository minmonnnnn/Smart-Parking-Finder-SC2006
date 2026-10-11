import { cleanup, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Button, Card, Chip, ProgressBar, progressPercent } from './index'

afterEach(cleanup)

describe('Button', () => {
  it('defaults to a non-submitting primary button', () => {
    render(<Button>Save to Favourites</Button>)
    const button = screen.getByRole('button', { name: 'Save to Favourites' })
    expect(button).toHaveAttribute('type', 'button')
    expect(button).toHaveClass('sp-button--primary', 'sp-button--md')
  })

  it('applies variant and full width, and hides the icon from assistive tech', () => {
    render(<Button variant="secondary" fullWidth icon={<svg data-testid="icon" />}>Navigate</Button>)
    const button = screen.getByRole('button', { name: 'Navigate' })
    expect(button).toHaveClass('sp-button--secondary', 'sp-button--full')
    expect(screen.getByTestId('icon').parentElement).toHaveAttribute('aria-hidden', 'true')
  })

  it('calls onClick unless disabled', async () => {
    const onClick = vi.fn()
    const { rerender } = render(<Button onClick={onClick}>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)

    rerender(<Button onClick={onClick} disabled>Go</Button>)
    await userEvent.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('Card', () => {
  it('renders children with default padding and passes through attributes', () => {
    render(<Card aria-label="Bishan Park II">120</Card>)
    const card = screen.getByLabelText('Bishan Park II')
    expect(card).toHaveClass('sp-card', 'sp-card--pad-md')
    expect(card).toHaveTextContent('120')
  })
})

describe('Chip', () => {
  it('acts as a toggle when no menu state is given', () => {
    const { rerender } = render(<Chip>Sheltered</Chip>)
    const chip = screen.getByRole('button', { name: 'Sheltered' })
    expect(chip).toHaveAttribute('aria-pressed', 'false')
    expect(chip).not.toHaveAttribute('aria-expanded')

    rerender(<Chip selected>Sheltered</Chip>)
    expect(chip).toHaveAttribute('aria-pressed', 'true')
    expect(chip).toHaveClass('sp-chip--active')
  })

  it('acts as a menu trigger when expanded is set', () => {
    render(<Chip expanded={false}>EV charger</Chip>)
    const chip = screen.getByRole('button', { name: 'EV charger' })
    expect(chip).toHaveAttribute('aria-expanded', 'false')
    expect(chip).toHaveAttribute('aria-haspopup', 'true')
    expect(chip).not.toHaveAttribute('aria-pressed')
  })
})

describe('ProgressBar', () => {
  it.each([
    [42, 120, 35],
    [0, 120, 0],
    [150, 120, 100],
    [-5, 120, 0],
    [10, 0, 0],
    [Number.NaN, 120, 0],
  ])('progressPercent(%s, %s) clamps to %s%%', (value, max, expected) => {
    expect(progressPercent(value, max)).toBe(expected)
  })

  it('exposes progress to assistive tech and sizes the fill', () => {
    render(<ProgressBar value={42} max={120} label="Bishan Park II availability" />)
    const bar = screen.getByRole('progressbar', { name: 'Bishan Park II availability' })
    expect(bar).toHaveAttribute('aria-valuenow', '42')
    expect(bar).toHaveAttribute('aria-valuemax', '120')
    expect(bar.firstElementChild).toHaveStyle({ width: '35%' })
    expect(bar.firstElementChild).toHaveClass('sp-progress__fill--success')
  })

  it('clamps out-of-range values', () => {
    render(<ProgressBar value={200} max={120} label="Full" tone="danger" />)
    const bar = screen.getByRole('progressbar', { name: 'Full' })
    expect(bar).toHaveAttribute('aria-valuenow', '120')
    expect(bar.firstElementChild).toHaveStyle({ width: '100%' })
  })
})
