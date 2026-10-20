import colors from '@/constants/colors';

/**
 * Returns the app's white, neutral design palette.
 *
 * The returned object contains all color tokens for the active palette
 * plus scheme-independent values like `radius`.
 *
 * PhotoVault intentionally uses a consistent light appearance so the gallery
 * stays clear and readable regardless of the device's system theme.
 */
export function useColors() {
  return { ...colors.light, radius: colors.radius };
}
