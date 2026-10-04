// "Whisper-quiet warmth" — see BRIEF.md design tokens.
import { Platform, TextStyle, ViewStyle } from 'react-native';

export const colors = {
  bg: '#FAF8F5', // soft off-white, faintest warm tint
  card: '#FFFFFF',
  hairline: 'rgba(70, 52, 40, 0.09)',
  hairlineStrong: 'rgba(70, 52, 40, 0.16)',
  ink: '#2E2926', // deep warm charcoal — never pure black
  ink2: '#857B73', // warm gray secondary
  ink3: '#B3AAA2', // tertiary / placeholders
  accent: '#BF6547', // terracotta — used sparingly
  accentSoft: '#F5E4DB',
  accentInk: '#FFFFFF',
  fill: '#F3F0EC', // input / quiet fills
  danger: '#B4483A',
};

export const radius = { sm: 10, md: 16, lg: 20, pill: 999 };
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 28 };
export const gutter = 20;

const family = Platform.select({ ios: 'System', default: undefined });

export const type = {
  title: { fontFamily: family, fontSize: 28, fontWeight: '500', color: colors.ink, letterSpacing: -0.3 },
  subline: { fontFamily: family, fontSize: 16, fontWeight: '400', color: colors.ink2 },
  prompt: { fontFamily: family, fontSize: 18, fontWeight: '500', color: colors.ink, letterSpacing: -0.2 },
  cardTitle: { fontFamily: family, fontSize: 17, fontWeight: '500', color: colors.ink, letterSpacing: -0.2 },
  body: { fontFamily: family, fontSize: 15, fontWeight: '400', color: colors.ink, lineHeight: 21 },
  secondary: { fontFamily: family, fontSize: 15, fontWeight: '400', color: colors.ink2, lineHeight: 20 },
  small: { fontFamily: family, fontSize: 13, fontWeight: '400', color: colors.ink2 },
  label: { fontFamily: family, fontSize: 13, fontWeight: '500', color: colors.ink2, letterSpacing: 0.1 },
} satisfies Record<string, TextStyle>;

export const cardStyle: ViewStyle = {
  backgroundColor: colors.card,
  borderRadius: radius.lg,
  borderWidth: StyleSheetHairline(),
  borderColor: colors.hairline,
  shadowColor: '#5A4030',
  shadowOpacity: 0.06,
  shadowRadius: 12,
  shadowOffset: { width: 0, height: 3 },
  elevation: 1,
};

function StyleSheetHairline() {
  return Platform.OS === 'ios' ? 0.5 : 1;
}

export const iconStroke = 1.75;
