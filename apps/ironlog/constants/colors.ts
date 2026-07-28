// IronLog design tokens — "Calm Strength"
// Single accent: electric lime. Warm-paper light + deep charcoal dark.

const light = {
  // Surfaces
  bg: "#F4F2EC",
  bgDeep: "#ECE9E0",
  surface: "#FFFFFF",
  surfaceAlt: "#F8F6EF",
  border: "#E3DFD3",
  borderStrong: "#C9C4B6",

  // Ink
  ink: "#0E0E0C",
  inkSoft: "#3A3A36",
  muted: "#6B6A62",
  mutedSoft: "#9A9890",

  // Accent — electric lime
  accent: "#C9F24D",
  accentInk: "#0E0E0C",
  accentSoft: "#E5F8A8",
  accentEdge: "#A5CC2E",

  // Muscle group hues — desaturated
  mPecho: "#D87A4F",
  mEspalda: "#5A86C4",
  mPiernas: "#5BA37A",
  mHombros: "#D9A24A",
  mBrazos: "#9A7BC0",
  mCore: "#C97A9A",

  // Status
  danger: "#C5443A",
  ok: "#5BA37A",

  // Back-compat aliases (mapped onto new palette)
  text: "#0E0E0C",
  tint: "#C9F24D",
  background: "#F4F2EC",
  foreground: "#0E0E0C",
  card: "#FFFFFF",
  cardForeground: "#0E0E0C",
  primary: "#C9F24D",
  primaryForeground: "#0E0E0C",
  secondary: "#F8F6EF",
  secondaryForeground: "#0E0E0C",
  mutedBg: "#F8F6EF",
  mutedForeground: "#6B6A62",
  accentBg: "#E5F8A8",
  accentForeground: "#A5CC2E",
  destructive: "#C5443A",
  destructiveForeground: "#FFFFFF",
  success: "#5BA37A",
  warning: "#D9A24A",
  input: "#E3DFD3",
  chestColor: "#D87A4F",
  backColor: "#5A86C4",
  legsColor: "#5BA37A",
  shouldersColor: "#D9A24A",
  armsColor: "#9A7BC0",
  coreColor: "#C97A9A",
};

const dark = {
  bg: "#0F0F0E",
  bgDeep: "#070706",
  surface: "#1A1A18",
  surfaceAlt: "#222220",
  border: "#2A2A26",
  borderStrong: "#3A3A35",

  ink: "#F2F0E8",
  inkSoft: "#D6D4CA",
  muted: "#8B8A82",
  mutedSoft: "#5C5B54",

  accent: "#C9F24D",
  accentInk: "#0E0E0C",
  accentSoft: "#3A4318",
  accentEdge: "#9DC134",

  mPecho: "#E89472",
  mEspalda: "#7BA0D6",
  mPiernas: "#7DBC97",
  mHombros: "#E5B66B",
  mBrazos: "#B398D6",
  mCore: "#DD9AB4",

  danger: "#E26259",
  ok: "#7DBC97",

  text: "#F2F0E8",
  tint: "#C9F24D",
  background: "#0F0F0E",
  foreground: "#F2F0E8",
  card: "#1A1A18",
  cardForeground: "#F2F0E8",
  primary: "#C9F24D",
  primaryForeground: "#0E0E0C",
  secondary: "#222220",
  secondaryForeground: "#F2F0E8",
  mutedBg: "#222220",
  mutedForeground: "#8B8A82",
  accentBg: "#3A4318",
  accentForeground: "#9DC134",
  destructive: "#E26259",
  destructiveForeground: "#FFFFFF",
  success: "#7DBC97",
  warning: "#E5B66B",
  input: "#2A2A26",
  chestColor: "#E89472",
  backColor: "#7BA0D6",
  legsColor: "#7DBC97",
  shouldersColor: "#E5B66B",
  armsColor: "#B398D6",
  coreColor: "#DD9AB4",
};

const colors = { light, dark, radius: 14 };

export type ThemePalette = typeof light;

export default colors;
