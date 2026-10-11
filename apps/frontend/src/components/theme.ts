// Shared design tokens (SRS 3.1 GUI standards). Import from here instead of hardcoding values.
//
// In TSX inline styles:   style={{ color: vars.color.secondary }}
// In CSS files:           color: var(--color-secondary);
//
// CSS variable names are derived from the token path: theme.color.textPrimary -> --color-text-primary,
// theme.space[4] -> --space-4. applyTheme() (called once in main.tsx) writes them onto :root.

export const theme = {
  color: {
    // SRS palette
    primary: '#FFC768', // banners, underlines, primary buttons
    secondary: '#2563EB', // navigation-related actions
    success: '#10B981', // availability, progress bars, EV "Supported"
    textPrimary: '#111827', // headings, primary text
    textSecondary: '#4B5563',
    textMuted: '#9CA3AF',
    background: '#FFFFFF',

    // Supporting colours (not in the SRS palette; needed for borders, states and error feedback)
    surface: '#F9FAFB', // page backdrop behind cards
    border: '#E5E7EB',
    track: '#E5E7EB', // empty part of progress bars
    primaryHover: '#FFB938',
    secondaryHover: '#1D4ED8',
    warning: '#F59E0B',
    danger: '#DC2626',
    onPrimary: '#111827', // text on orange: white on #FFC768 fails WCAG contrast
    onSecondary: '#FFFFFF',
  },
  font: {
    family: "system-ui, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
  },
  fontSize: {
    xs: '12px', // uppercase labels ("AVAILABLE", "TOTAL SPOTS")
    sm: '14px',
    md: '16px', // body
    lg: '18px',
    xl: '22px', // page titles
  },
  fontWeight: {
    regular: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
  space: {
    1: '4px',
    2: '8px',
    3: '12px',
    4: '16px',
    5: '20px',
    6: '24px',
    8: '32px',
  },
  radius: {
    sm: '6px',
    md: '10px',
    lg: '14px',
    pill: '999px',
  },
  shadow: {
    card: '0 1px 2px rgba(17, 24, 39, 0.06)',
    raised: '0 4px 12px rgba(17, 24, 39, 0.12)',
  },
  layout: {
    // SRS mobile portrait baseline
    viewportWidth: '480px',
    viewportHeight: '960px',
    gutter: '16px',
  },
} as const

type Theme = typeof theme
export type ThemeVars = { readonly [G in keyof Theme]: { readonly [K in keyof Theme[G]]: string } }

function kebab(value: string): string {
  return value.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)
}

export function cssVarName(group: string, token: string): string {
  return `--${kebab(group)}-${kebab(token)}`
}

const groups = Object.entries(theme) as [string, Record<string, string>][]

export const cssVariables: Readonly<Record<string, string>> = Object.fromEntries(
  groups.flatMap(([group, tokens]) =>
    Object.entries(tokens).map(([token, value]) => [cssVarName(group, token), value]),
  ),
)

export const vars = Object.fromEntries(
  groups.map(([group, tokens]) => [
    group,
    Object.fromEntries(Object.keys(tokens).map((token) => [token, `var(${cssVarName(group, token)})`])),
  ]),
) as unknown as ThemeVars

export function applyTheme(root: HTMLElement = document.documentElement): void {
  for (const [name, value] of Object.entries(cssVariables)) root.style.setProperty(name, value)
}
