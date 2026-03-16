const GAP = 1000;

/**
 * Compute the position value for inserting an item at `targetIndex`
 * among siblings with the given sorted positions.
 *
 * Uses midpoint insertion with gap-based spacing.
 * If the gap is exhausted (midpoint equals a neighbor), signals that
 * all siblings need renumbering.
 */
export function computeInsertPosition(
  siblingPositions: number[],
  targetIndex: number,
): { position: number; needsRenumber: boolean } {
  if (siblingPositions.length === 0) {
    return { position: 0, needsRenumber: false };
  }

  if (targetIndex <= 0) {
    return { position: siblingPositions[0] - GAP, needsRenumber: false };
  }

  if (targetIndex >= siblingPositions.length) {
    return {
      position: siblingPositions[siblingPositions.length - 1] + GAP,
      needsRenumber: false,
    };
  }

  const before = siblingPositions[targetIndex - 1];
  const after = siblingPositions[targetIndex];
  const mid = Math.floor((before + after) / 2);

  if (mid === before || mid === after) {
    return { position: -1, needsRenumber: true };
  }

  return { position: mid, needsRenumber: false };
}

/**
 * Generate fresh position values with GAP spacing for `count` items.
 */
export function renumberPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => i * GAP);
}

export const POSITION_GAP = GAP;
