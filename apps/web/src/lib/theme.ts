/**
 * Web theme bridge — imports shared tokens and re-exports as CSS custom properties
 * for Tailwind v4 CSS-based configuration.
 */
import { theme } from '@nivas/shared-theme';

export const colors = theme.colors;
export const spacing = theme.spacing;
export const radii = theme.radii;
export const typography = theme.typography;
export const shadows = theme.shadows;

/**
 * Generate CSS custom properties from shared theme tokens.
 * Import this string into your CSS file:
 *   import { cssVariables } from '@/lib/theme';
 *   // Then use cssVariables in a style tag or CSS-in-JS
 */
export const cssVariables = Object.entries(theme.colors)
  .flatMap(([name, scale]) => {
    if (typeof scale === 'string') {
      return [`--color-${name}: ${scale};`];
    }
    return Object.entries(scale).map(
      ([shade, value]) => `--color-${name}-${shade}: ${value};`
    );
  })
  .join('\n');
