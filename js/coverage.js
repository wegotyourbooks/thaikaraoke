// Spoken-coverage curve: interpolate between anchor points.
// rank 100 = 47%, 500 = 71%, 1000 = 81%, 1200 = 84%.
const ANCHORS = [[0, 0], [100, 47], [500, 71], [1000, 81], [1200, 84]];

export function coverageForRank(rank) {
  if (rank <= 0) return 0;
  const last = ANCHORS[ANCHORS.length - 1];
  if (rank >= last[0]) return last[1];
  for (let i = 1; i < ANCHORS.length; i++) {
    const [r1, c1] = ANCHORS[i];
    if (rank <= r1) {
      const [r0, c0] = ANCHORS[i - 1];
      return c0 + (c1 - c0) * (rank - r0) / (r1 - r0);
    }
  }
  return last[1];
}

// Coverage credit for a set of learned word ranks: counts a rank as covered
// only if learned, using the density of the curve at each rank. Learned ranks
// need not be contiguous, so integrate per-rank marginal coverage.
export function coverageForLearnedRanks(ranks) {
  let total = 0;
  for (const r of ranks) {
    total += coverageForRank(r) - coverageForRank(r - 1);
  }
  return Math.min(84, total);
}
