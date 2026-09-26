/**
 * The shelf board both 3D views stand their books on, drawn as seen from a little above:
 * the top surface running back to the wall (darker at the back), a lit lip where it turns
 * down, the front face with a darker underside, and a soft shadow the board casts on the
 * wall below. Positions are
 * pixels from the top of a row; the colors are theme tokens, so it reads the same way in
 * light and dark.
 */
type BoardLines = { back: number; front: number; edge: number; row: number };

const shadowEnd = ({ edge, row }: BoardLines) => Math.min(row, edge + 12);

export function shelfBoard(lines: BoardLines) {
  const { back, front, edge } = lines;
  return [
    "linear-gradient(to bottom",
    `transparent ${back}px`,
    `var(--shelf-back) ${back}px`,
    `var(--shelf-top) ${front - 1}px`,
    `var(--shelf-lip) ${front - 1}px ${front}px`,
    `var(--shelf-edge) ${front}px ${edge - 1}px`,
    `var(--shelf-under) ${edge - 1}px ${edge}px`,
    `var(--shelf-shadow) ${edge}px`,
    `transparent ${shadowEnd(lines)}px)`,
  ].join(", ");
}

/**
 * Shapes the board's ends for a camera over the middle of the row: the top surface narrows
 * by `inset` on each side toward the wall, the front face runs the full width, and the
 * shadow on the wall is as long as the board's back.
 */
export function boardClip(lines: BoardLines, inset: number) {
  const { back, front, edge } = lines;
  const end = shadowEnd(lines);
  const right = `calc(100% - ${inset}px)`;
  return `polygon(${inset}px ${back}px, ${right} ${back}px, 100% ${front}px, 100% ${edge}px, ${right} ${edge}px, ${right} ${end}px, ${inset}px ${end}px, ${inset}px ${edge}px, 0 ${edge}px, 0 ${front}px)`;
}
