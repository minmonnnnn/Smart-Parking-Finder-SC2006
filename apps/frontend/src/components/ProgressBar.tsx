import { classNames } from './class-names'
import { progressPercent } from './progress-percent'
import './ProgressBar.css'

export interface ProgressBarProps {
  value: number
  max?: number
  /** Accessible name, e.g. "Bishan Park II availability". */
  label: string
  /** success = green per SRS; warning/danger are for low-availability states. */
  tone?: 'success' | 'warning' | 'danger'
  className?: string
}

// Shell only: availability-specific text ("35% available") and status thresholds live in Xi Fei's badge.
export function ProgressBar({ value, max = 100, label, tone = 'success', className }: ProgressBarProps) {
  const percent = progressPercent(value, max)
  const safeMax = Number.isFinite(max) && max > 0 ? max : 100
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={safeMax}
      aria-valuenow={Math.round((percent / 100) * safeMax)}
      className={classNames('sp-progress', className)}
    >
      <div className={`sp-progress__fill sp-progress__fill--${tone}`} style={{ width: `${percent}%` }} />
    </div>
  )
}
