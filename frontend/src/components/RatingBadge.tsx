"use client";

import { RatingTier, getRatingTier } from "@/types/game";
import { isProvisionalRating } from "@/utils/elo";

interface RatingBadgeProps {
  rating: number;
  gamesPlayed?: number;
  size?: 'sm' | 'md' | 'lg';
  showChange?: boolean;
  ratingChange?: number;
  className?: string;
}

const tierColors: Record<RatingTier, { bg: string; text: string }> = {
  [RatingTier.Beginner]: { bg: 'bg-gray-500', text: 'text-white' },
  [RatingTier.Intermediate]: { bg: 'bg-green-600', text: 'text-white' },
  [RatingTier.Advanced]: { bg: 'bg-blue-600', text: 'text-white' },
  [RatingTier.Expert]: { bg: 'bg-purple-600', text: 'text-white' },
  [RatingTier.Master]: { bg: 'bg-gradient-to-r from-amber-400 to-yellow-500', text: 'text-black' },
};

const sizeClasses = {
  sm: 'text-xs px-1.5 py-0.5 rounded',
  md: 'text-sm px-2 py-0.5 rounded',
  lg: 'text-base px-2.5 py-1 rounded-md',
};

export default function RatingBadge({
  rating,
  gamesPlayed = 0,
  size = 'sm',
  showChange = false,
  ratingChange = 0,
  className = '',
}: RatingBadgeProps) {
  const tier = getRatingTier(rating);
  const colors = tierColors[tier];
  const isProvisional = isProvisionalRating(gamesPlayed);

  return (
    <span
      className={`
        inline-flex items-center gap-0.5 font-mono font-semibold
        ${colors.bg} ${colors.text}
        ${sizeClasses[size]}
        ${className}
      `}
    >
      <span>{rating}</span>
      {isProvisional && (
        <span className="opacity-70 text-[0.7em]">?</span>
      )}
      {showChange && ratingChange !== 0 && (
        <span
          className={`ml-0.5 text-[0.8em] ${ratingChange > 0 ? 'text-green-300' : 'text-red-300'}`}
        >
          {ratingChange > 0 ? '+' : ''}{ratingChange}
        </span>
      )}
    </span>
  );
}

export function InlineRating({ rating, gamesPlayed = 0 }: { rating: number; gamesPlayed?: number }) {
  const tier = getRatingTier(rating);
  const isProvisional = isProvisionalRating(gamesPlayed);

  const colorClass = {
    [RatingTier.Beginner]: 'text-gray-400',
    [RatingTier.Intermediate]: 'text-green-500',
    [RatingTier.Advanced]: 'text-blue-500',
    [RatingTier.Expert]: 'text-purple-500',
    [RatingTier.Master]: 'text-amber-500',
  }[tier];

  return (
    <span className={`font-mono font-medium ${colorClass}`}>
      ({rating}{isProvisional ? '?' : ''})
    </span>
  );
}
