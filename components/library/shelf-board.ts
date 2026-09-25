/**
 * The shelf board both 3D views stand their books on, drawn as seen from a little above:
 * the top surface running back to the wall (darker at the back), a lit lip where it turns
 * down, the front face with a darker underside, and a soft shadow the board casts on the
 * wall below. Positions are
 * pixels from the top of a row; the colors are theme tokens, so it reads the same way in
 * light and dark.
 */
export function shelfBoard({ back, front, edge, row }: { back: number; front: number; edge: number; row: number }) {
  const shadowEnd = Math.min(row, edge + 12);
  return [
    "linear-gradient(to bottom",
    `transparent ${back}px`,
    `var(--shelf-back) ${back}px`,
    `var(--shelf-top) ${front - 1}px`,
    `var(--shelf-lip) ${front - 1}px ${front}px`,
    `var(--shelf-edge) ${front}px ${edge - 1}px`,
    `var(--shelf-under) ${edge - 1}px ${edge}px`,
    `var(--shelf-shadow) ${edge}px`,
    `transparent ${shadowEnd}px)`,
  ].join(", ");
}
