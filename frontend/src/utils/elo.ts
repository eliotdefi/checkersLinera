// ELO Rating Calculation Utility
// Based on standard chess ELO formula

export interface EloResult {
  newRating: number;
  ratingChange: number;
}

export function calculateElo(
  playerRating: number,
  opponentRating: number,
  result: 'win' | 'loss' | 'draw',
  gamesPlayed: number
): EloResult {
  const K = gamesPlayed < 30 ? 32 : 16;
  const expectedScore = 1 / (1 + Math.pow(10, (opponentRating - playerRating) / 400));

  let actualScore: number;
  switch (result) {
    case 'win': actualScore = 1; break;
    case 'draw': actualScore = 0.5; break;
    case 'loss': actualScore = 0; break;
  }

  const ratingChange = Math.round(K * (actualScore - expectedScore));
  const newRating = Math.max(100, Math.min(3000, playerRating + ratingChange));

  return { newRating, ratingChange };
}

export const DEFAULT_RATING = 1200;
export const MIN_RATING = 100;
export const MAX_RATING = 3000;
export const PROVISIONAL_GAMES_THRESHOLD = 30;

export function isProvisionalRating(gamesPlayed: number): boolean {
  return gamesPlayed < PROVISIONAL_GAMES_THRESHOLD;
}

export function formatRatingChange(change: number): string {
  if (change > 0) return `+${change}`;
  return `${change}`;
}
