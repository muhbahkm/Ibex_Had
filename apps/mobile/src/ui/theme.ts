const spacingScale = {
  0: 0,
  4: 4,
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  24: 24,
  32: 32,
  40: 40,
  48: 48,
} as const;

const radiusScale = {
  8: 8,
  12: 12,
  16: 16,
  20: 20,
  28: 28,
  full: 999,
} as const;

export const theme = {
  colors: {
    background: '#F7F7F5',
    surface: '#FFFFFF',
    surfaceMuted: '#F0F1EE',
    surfaceTinted: '#F4F7F5',
    surfaceElevated: '#FFFFFF',
    text: '#181A18',
    textMuted: '#6D716B',
    textSubtle: '#8A8E88',
    textInverse: '#FFFFFF',
    border: '#E2E4DF',
    borderStrong: '#C9CDC6',
    accent: '#1D3A32',
    accentPressed: '#152C26',
    accentMuted: '#E6EEEA',
    accentText: '#FFFFFF',
    success: '#286A4B',
    successSurface: '#EAF4EE',
    warning: '#8B6418',
    warningSurface: '#F8F0DC',
    danger: '#A33A36',
    dangerSurface: '#F9E9E7',
    info: '#315C78',
    infoSurface: '#E9F1F6',

    // Compatibility aliases for existing screens while the product shell is migrated.
    primary: '#1D3A32',
    primaryPressed: '#152C26',
    primaryText: '#FFFFFF',
  },
  spacing: {
    scale: spacingScale,
    none: spacingScale[0],
    xxs: spacingScale[4],
    xs: spacingScale[8],
    sm: spacingScale[12],
    md: spacingScale[16],
    lg: spacingScale[24],
    xl: spacingScale[32],
    xxl: spacingScale[40],
    xxxl: spacingScale[48],
  },
  radius: {
    scale: radiusScale,
    xs: radiusScale[8],
    sm: radiusScale[12],
    md: radiusScale[16],
    lg: radiusScale[20],
    xl: radiusScale[28],
    full: radiusScale.full,

    // Compatibility alias.
    pill: radiusScale.full,
  },
  layout: {
    minTouchTarget: 44,
    bottomNavigationHeight: 72,
    appBarHeight: 64,
    mobileContentMaxWidth: 600,
    screenHorizontalPadding: spacingScale[24],
  },
  motion: {
    fast: 120,
    base: 200,
    emphasized: 320,
  },
  typography: {
    fontFamily: {
      arabic: 'Noto Sans Arabic',
      fallback: undefined,
    },
    styles: {
      display: { fontSize: 30, lineHeight: 40, fontWeight: '700' as const },
      title: { fontSize: 22, lineHeight: 32, fontWeight: '700' as const },
      heading: { fontSize: 18, lineHeight: 28, fontWeight: '700' as const },
      body: { fontSize: 16, lineHeight: 26, fontWeight: '400' as const },
      bodyStrong: { fontSize: 16, lineHeight: 26, fontWeight: '700' as const },
      label: { fontSize: 14, lineHeight: 22, fontWeight: '600' as const },
      caption: { fontSize: 13, lineHeight: 20, fontWeight: '400' as const },
      captionStrong: { fontSize: 13, lineHeight: 20, fontWeight: '700' as const },
    },

    // Compatibility aliases for the current mobile screens.
    title: 30,
    heading: 22,
    body: 16,
    caption: 13,
  },
  elevation: {
    low: {
      shadowColor: '#000000',
      shadowOpacity: 0.05,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    medium: {
      shadowColor: '#000000',
      shadowOpacity: 0.08,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 6 },
      elevation: 3,
    },
    high: {
      shadowColor: '#000000',
      shadowOpacity: 0.12,
      shadowRadius: 24,
      shadowOffset: { width: 0, height: 10 },
      elevation: 6,
    },
  },
} as const;

export type IbexTheme = typeof theme;
