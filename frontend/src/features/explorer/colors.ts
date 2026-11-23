/** Colour scaled towards the surface: share 0 → surface, 1 → full colour. */
export const tint = (color: string, share: number) =>
  `color-mix(in srgb, ${color} ${Math.round(8 + 92 * Math.max(0, Math.min(1, share)))}%, var(--surface))`;
