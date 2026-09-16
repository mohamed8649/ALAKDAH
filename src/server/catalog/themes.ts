/**
 * Theme catalogue.
 *
 * A theme is not a primary-colour swap. Each definition carries design tokens
 * *and* a section composition — which storefront sections appear, in what order
 * and in which layout variant — so switching theme changes the structure of the
 * shop, not just its accent colour.
 */

export interface ThemeTokens {
  primary: string;
  secondary: string;
  background: string;
  surface: string;
  foreground: string;
  muted: string;
  border: string;
  radius: string;
  fontScale: string;
  /** Product card aspect ratio and density. */
  cardStyle: 'flat' | 'outlined' | 'raised';
  buttonStyle: 'solid' | 'pill' | 'square';
}

export interface ThemeSection {
  key:
    | 'announcement'
    | 'hero'
    | 'featured_collections'
    | 'product_grid'
    | 'trust'
    | 'testimonials'
    | 'newsletter'
    | 'footer';
  enabled: boolean;
  variant: string;
}

export interface ThemeSeed {
  key: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  previewImage: string;
  isPremium: boolean;
  position: number;
  tokens: ThemeTokens;
  sections: readonly ThemeSection[];
}

const BASE_SECTIONS: readonly ThemeSection[] = [
  { key: 'announcement', enabled: true, variant: 'bar' },
  { key: 'hero', enabled: true, variant: 'split' },
  { key: 'featured_collections', enabled: true, variant: 'cards' },
  { key: 'product_grid', enabled: true, variant: 'grid-3' },
  { key: 'trust', enabled: true, variant: 'row' },
  { key: 'testimonials', enabled: false, variant: 'quotes' },
  { key: 'footer', enabled: true, variant: 'columns' },
];

export const THEMES: readonly ThemeSeed[] = [
  {
    key: 'aswaq',
    nameAr: 'أسواق',
    nameEn: 'Aswaq',
    descriptionAr: 'قالب افتراضي نظيف وسريع، مناسب لأغلب المتاجر.',
    previewImage: '/themes/aswaq.svg',
    isPremium: false,
    position: 0,
    tokens: {
      primary: '#00b77b',
      secondary: '#0b1929',
      background: '#ffffff',
      surface: '#f7f9fb',
      foreground: '#101b28',
      muted: '#5b6a7a',
      border: '#e4eaf0',
      radius: '10px',
      fontScale: '1',
      cardStyle: 'outlined',
      buttonStyle: 'solid',
    },
    sections: BASE_SECTIONS,
  },
  {
    key: 'sahra',
    nameAr: 'صحراء',
    nameEn: 'Sahra',
    descriptionAr: 'ألوان دافئة وتباعد مريح، مناسب للمنتجات اليدوية والتراثية.',
    previewImage: '/themes/sahra.svg',
    isPremium: false,
    position: 1,
    tokens: {
      primary: '#c1743a',
      secondary: '#3b2a1d',
      background: '#fdfaf6',
      surface: '#f5ece1',
      foreground: '#2c2118',
      muted: '#7b6753',
      border: '#e6d8c6',
      radius: '14px',
      fontScale: '1.02',
      cardStyle: 'flat',
      buttonStyle: 'pill',
    },
    sections: [
      { key: 'announcement', enabled: true, variant: 'bar' },
      { key: 'hero', enabled: true, variant: 'full-bleed' },
      { key: 'product_grid', enabled: true, variant: 'grid-2' },
      { key: 'featured_collections', enabled: true, variant: 'list' },
      { key: 'trust', enabled: true, variant: 'stack' },
      { key: 'testimonials', enabled: true, variant: 'quotes' },
      { key: 'footer', enabled: true, variant: 'simple' },
    ],
  },
  {
    key: 'layl',
    nameAr: 'ليل',
    nameEn: 'Layl',
    descriptionAr: 'قالب داكن عالي التباين، مناسب للإلكترونيات والأزياء.',
    previewImage: '/themes/layl.svg',
    isPremium: false,
    position: 2,
    tokens: {
      primary: '#3b9df5',
      secondary: '#e8eef5',
      background: '#0b1018',
      surface: '#141c27',
      foreground: '#e8eef5',
      muted: '#8fa3b8',
      border: '#1f2a38',
      radius: '6px',
      fontScale: '1',
      cardStyle: 'raised',
      buttonStyle: 'square',
    },
    sections: [
      { key: 'announcement', enabled: true, variant: 'bar' },
      { key: 'hero', enabled: true, variant: 'centered' },
      { key: 'product_grid', enabled: true, variant: 'grid-4' },
      { key: 'featured_collections', enabled: true, variant: 'cards' },
      { key: 'trust', enabled: true, variant: 'row' },
      { key: 'footer', enabled: true, variant: 'columns' },
    ],
  },
  {
    key: 'zahra',
    nameAr: 'زهرة',
    nameEn: 'Zahra',
    descriptionAr: 'ناعم وهادئ، مناسب لمستحضرات التجميل والعناية.',
    previewImage: '/themes/zahra.svg',
    isPremium: true,
    position: 3,
    tokens: {
      primary: '#d9668a',
      secondary: '#4a2c38',
      background: '#fffafb',
      surface: '#fdf0f4',
      foreground: '#3a2028',
      muted: '#8a6b76',
      border: '#f3dde4',
      radius: '18px',
      fontScale: '1.02',
      cardStyle: 'flat',
      buttonStyle: 'pill',
    },
    sections: BASE_SECTIONS,
  },
  {
    key: 'souq',
    nameAr: 'سوق',
    nameEn: 'Souq',
    descriptionAr: 'كثيف ومباشر، يعرض أكبر عدد من المنتجات في المساحة المتاحة.',
    previewImage: '/themes/souq.svg',
    isPremium: false,
    position: 4,
    tokens: {
      primary: '#f2a33c',
      secondary: '#1c2431',
      background: '#ffffff',
      surface: '#f4f6f8',
      foreground: '#141c27',
      muted: '#5d6b7b',
      border: '#e2e7ec',
      radius: '4px',
      fontScale: '0.98',
      cardStyle: 'outlined',
      buttonStyle: 'square',
    },
    sections: [
      { key: 'announcement', enabled: true, variant: 'bar' },
      { key: 'hero', enabled: true, variant: 'compact' },
      { key: 'featured_collections', enabled: true, variant: 'chips' },
      { key: 'product_grid', enabled: true, variant: 'grid-4' },
      { key: 'trust', enabled: true, variant: 'row' },
      { key: 'footer', enabled: true, variant: 'simple' },
    ],
  },
  {
    key: 'nakhla',
    nameAr: 'نخلة',
    nameEn: 'Nakhla',
    descriptionAr: 'أخضر هادئ وصور كبيرة، مناسب للأغذية والمنتجات الطبيعية.',
    previewImage: '/themes/nakhla.svg',
    isPremium: true,
    position: 5,
    tokens: {
      primary: '#2f8f5b',
      secondary: '#1c3326',
      background: '#fbfdfb',
      surface: '#eef5f0',
      foreground: '#16261d',
      muted: '#5d7268',
      border: '#dceae1',
      radius: '12px',
      fontScale: '1.02',
      cardStyle: 'flat',
      buttonStyle: 'pill',
    },
    sections: BASE_SECTIONS,
  },
] as const;

export const DEFAULT_THEME_KEY = 'aswaq';

export function getTheme(key: string): ThemeSeed | null {
  return THEMES.find((theme) => theme.key === key) ?? null;
}

/** Merge a theme's tokens with the merchant's overrides. */
export function resolveThemeTokens(
  themeKey: string,
  overrides: Partial<ThemeTokens> | null | undefined,
): ThemeTokens {
  const theme = getTheme(themeKey) ?? getTheme(DEFAULT_THEME_KEY)!;
  return { ...theme.tokens, ...(overrides ?? {}) };
}

/** Turn theme tokens into the CSS custom properties the storefront reads. */
export function themeCssVariables(tokens: ThemeTokens): Record<string, string> {
  return {
    '--primary': tokens.primary,
    '--primary-hover': tokens.primary,
    '--primary-active': tokens.primary,
    '--primary-foreground': '#ffffff',
    '--primary-soft': `color-mix(in srgb, ${tokens.primary} 12%, transparent)`,
    '--background': tokens.background,
    '--surface-1': tokens.background,
    '--surface-2': tokens.surface,
    '--surface-3': tokens.surface,
    '--surface-elevated': tokens.background,
    '--foreground': tokens.foreground,
    '--muted-foreground': tokens.muted,
    '--subtle-foreground': tokens.muted,
    '--border': tokens.border,
    '--border-strong': tokens.border,
    '--input': tokens.background,
    '--radius': tokens.radius,
    '--radius-lg': tokens.radius,
    '--focus-ring': tokens.primary,
  };
}
