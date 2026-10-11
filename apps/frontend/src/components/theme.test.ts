import { describe, expect, it } from 'vitest'
import { applyTheme, cssVarName, cssVariables, theme, vars } from './theme'

describe('theme', () => {
  it('uses the exact SRS colour palette', () => {
    expect(theme.color).toMatchObject({
      primary: '#FFC768',
      secondary: '#2563EB',
      success: '#10B981',
      textPrimary: '#111827',
      textSecondary: '#4B5563',
      textMuted: '#9CA3AF',
      background: '#FFFFFF',
    })
  })

  it('derives kebab-case CSS variable names from token paths', () => {
    expect(cssVarName('color', 'textPrimary')).toBe('--color-text-primary')
    expect(cssVarName('fontSize', 'xl')).toBe('--font-size-xl')
    expect(cssVarName('space', '4')).toBe('--space-4')
  })

  it('exposes every token as a CSS variable and a var() reference', () => {
    expect(cssVariables['--color-primary']).toBe('#FFC768')
    expect(cssVariables['--space-4']).toBe('16px')
    expect(vars.color.secondary).toBe('var(--color-secondary)')
    expect(vars.space[4]).toBe('var(--space-4)')

    const tokenCount = Object.values(theme).reduce((count, group) => count + Object.keys(group).length, 0)
    expect(Object.keys(cssVariables)).toHaveLength(tokenCount)
  })

  it('writes the variables onto the given root element', () => {
    const root = document.createElement('div')
    applyTheme(root)
    expect(root.style.getPropertyValue('--color-success')).toBe('#10B981')
    expect(root.style.getPropertyValue('--layout-viewport-width')).toBe('480px')
  })
})
