import { createTheme, type MantineColorsTuple } from '@mantine/core'

// Violet shades — primary brand color (#7c3aed base)
const nexoraViolet: MantineColorsTuple = [
  '#f3eeff', // 0 — lightest
  '#e4d9fc', // 1
  '#c9b2f9', // 2
  '#ad87f6', // 3
  '#9562f3', // 4
  '#8a4af1', // 5
  '#7c3aed', // 6 — brand base (PRIMARY)
  '#6b2dd4', // 7
  '#5a22b8', // 8
  '#47199a', // 9 — darkest
]

// Cyan shades — accent color (#06b6d4 base)
const nexoraCyan: MantineColorsTuple = [
  '#e0f9ff', // 0
  '#b8f0fb', // 1
  '#86e4f6', // 2
  '#4fd4ef', // 3
  '#1ec7ea', // 4
  '#06b6d4', // 5 — brand base (ACCENT)
  '#059ab5', // 6
  '#047d93', // 7
  '#036273', // 8
  '#024855', // 9
]

export const nexoraTheme = createTheme({
  fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, Fira Code, Consolas, monospace',
  headings: {
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
    fontWeight: '700',
  },

  primaryColor: 'nexoraViolet',
  primaryShade: { light: 6, dark: 5 },

  colors: {
    nexoraViolet,
    nexoraCyan,
  },

  defaultRadius: 'md',

  black: '#0d0d0d',
  white: '#ffffff',

  shadows: {
    xs: '0 1px 2px rgba(0, 0, 0, 0.3)',
    sm: '0 2px 8px rgba(0, 0, 0, 0.35)',
    md: '0 4px 16px rgba(0, 0, 0, 0.4)',
    lg: '0 8px 32px rgba(0, 0, 0, 0.45)',
    xl: '0 16px 48px rgba(0, 0, 0, 0.5)',
  },

  components: {
    Button: {
      defaultProps: {
        radius: 'md',
      },
    },
    Card: {
      defaultProps: {
        radius: 'md',
        withBorder: true,
      },
    },
    TextInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    PasswordInput: {
      defaultProps: {
        radius: 'md',
      },
    },
    Select: {
      defaultProps: {
        radius: 'md',
      },
    },
    Textarea: {
      defaultProps: {
        radius: 'md',
      },
    },
    Avatar: {
      defaultProps: {
        radius: 'xl',
      },
    },
    Badge: {
      defaultProps: {
        radius: 'sm',
      },
    },
    Modal: {
      defaultProps: {
        radius: 'lg',
        centered: true,
      },
    },
    Notification: {
      defaultProps: {
        radius: 'md',
      },
    },
    Paper: {
      defaultProps: {
        radius: 'md',
      },
    },
  },
})

export default nexoraTheme
