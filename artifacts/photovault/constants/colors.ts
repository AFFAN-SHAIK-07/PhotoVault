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
    text: '#18251f',
    tint: '#2e684f',

    // Core surfaces
    background: '#f4f4ee',
    foreground: '#18251f',

    // Cards / elevated surfaces
    card: '#ffffff',
    cardForeground: '#18251f',

    // Primary action color (buttons, links, active states)
    primary: '#2e684f',
    primaryForeground: '#ffffff',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#e8ece5',
    secondaryForeground: '#26362e',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#e8ece5',
    mutedForeground: '#68766d',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#e5f3c5',
    accentForeground: '#274532',

    // Destructive actions (delete, error states)
    destructive: '#b84f42',
    destructiveForeground: '#ffffff',

    // Borders and input outlines
    border: '#dce2d9',
    input: '#dce2d9',
  },
  dark: {
    text: '#f0f4ed',
    tint: '#b4df79',
    background: '#111914',
    foreground: '#f0f4ed',
    card: '#1a241d',
    cardForeground: '#f0f4ed',
    primary: '#b4df79',
    primaryForeground: '#18231b',
    secondary: '#243128',
    secondaryForeground: '#e1e9dd',
    muted: '#243128',
    mutedForeground: '#a5b1a7',
    accent: '#304333',
    accentForeground: '#d5efae',
    destructive: '#d97869',
    destructiveForeground: '#1b100e',
    border: '#304035',
    input: '#304035',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 12,
};

export default colors;
