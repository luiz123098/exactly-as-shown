// Exotic brand tokens, converted from the web app's palette (src/styles.css).
export const colors = {
  background: '#fafafa',
  card: '#ffffff',
  text: '#0a0a0a',
  textMuted: '#636363',
  ink: '#0a0a0a',
  inkText: '#fafafa',
  inkMuted: '#242424',
  highlight: '#fa7d1a',
  highlightDeep: '#8f3b00',
  accent: '#feefe1',
  accentText: '#5d2a0b',
  secondary: '#f4f4f4',
  border: '#e4e4e4',
  input: '#dedede',
  danger: '#d63330',
  success: '#1f8a4c',
} as const;

export const fonts = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
  extrabold: 'Manrope_800ExtraBold',
} as const;

export const space = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;
export const radius = { sm: 8, md: 14, lg: 20, pill: 999 } as const;
