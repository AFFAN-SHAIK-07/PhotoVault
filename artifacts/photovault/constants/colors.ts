/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#202124',
    tint: '#202124',

    // Core surfaces
    background: '#ffffff',
    foreground: '#202124',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#202124',

    // Primary action color (buttons, links, active states)
    primary: '#202124',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#f4f4f5',
    secondaryForeground: '#3f3f46',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#f4f4f5',
    mutedForeground: '#71717a',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#f1f1f2',
    accentForeground: '#3f3f46',

    // Destructive actions (delete, error states)
    destructive: '#e0525c',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#e7e7e9',
    input: '#dedee2',
  },
  dark: {
    text: '#f4f4f5',
    tint: '#f4f4f5',
    background: '#18181b',
    foreground: '#f4f4f5',
    card: '#27272a',
    cardForeground: '#f4f4f5',
    primary: '#f4f4f5',
    primaryForeground: '#18181b',
    secondary: '#27272a',
    secondaryForeground: '#e4e4e7',
    muted: '#27272a',
    mutedForeground: '#a1a1aa',
    accent: '#3f3f46',
    accentForeground: '#f4f4f5',
    destructive: '#f87171',
    destructiveForeground: '#18181b',
    border: '#3f3f46',
    input: '#52525b',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 12,
};

export default colors;
