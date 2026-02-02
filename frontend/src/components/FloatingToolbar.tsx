"use client";

import { DrawOfferState } from "@/types/game";

interface FloatingToolbarProps {
  drawOfferState: DrawOfferState;
  isGameActive: boolean;
  onResign: () => void;
  onOfferDraw: () => void;
  onAcceptDraw: () => void;
  onDeclineDraw: () => void;
  onLeaveGame: () => void;
  onToggleSound: () => void;
  onToggleFullscreen: () => void;
  isSoundEnabled: boolean;
  isLoading?: boolean;
}

// Icon Button with tooltip
function IconButton({
  icon,
  tooltip,
  onClick,
  disabled = false,
  variant = "default",
  active = false,
}: {
  icon: React.ReactNode;
  tooltip: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "danger" | "success";
  active?: boolean;
}) {
  const getVariantClasses = () => {
    if (disabled) return "text-gray-500 cursor-not-allowed";
    switch (variant) {
      case "danger":
        return "text-red-400 hover:bg-red-500/20 hover:text-red-300";
      case "success":
        return "text-green-400 hover:bg-green-500/20 hover:text-green-300";
      default:
        return active
          ? "text-linera-accent bg-linera-accent/20"
          : "text-white hover:bg-white/10";
    }
  };

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`
        p-2.5 rounded-full transition-all duration-150 relative group
        ${getVariantClasses()}
      `}
    >
      {icon}
      {/* Tooltip */}
      <span
        className="
          absolute bottom-full left-1/2 -translate-x-1/2 mb-2
          bg-black/90 text-white text-xs px-2 py-1 rounded
          opacity-0 group-hover:opacity-100 transition-opacity
          pointer-events-none whitespace-nowrap z-50
        "
      >
        {tooltip}
      </span>
    </button>
  );
}

// SVG Icons
const FlagIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M3 21v-4m0 0V5a2 2 0 012-2h6.5l1 1H21l-3 6 3 6h-8.5l-1-1H5a2 2 0 00-2 2zm9-13.5V9"
    />
  </svg>
);

const HandshakeIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
    />
  </svg>
);

const DoorIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"
    />
  </svg>
);

const SoundOnIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
    />
  </svg>
);

const SoundOffIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
    />
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
    />
  </svg>
);

const ExpandIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
    />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

const XIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
);

export default function FloatingToolbar({
  drawOfferState,
  isGameActive,
  onResign,
  onOfferDraw,
  onAcceptDraw,
  onDeclineDraw,
  onLeaveGame,
  onToggleSound,
  onToggleFullscreen,
  isSoundEnabled,
  isLoading = false,
}: FloatingToolbarProps) {
  // Handle draw offer states
  const showDrawAcceptReject = drawOfferState === DrawOfferState.OfferedByOpponent;
  const drawOffered = drawOfferState === DrawOfferState.OfferedByMe;

  return (
    <div
      className="
        fixed bottom-4 left-1/2 -translate-x-1/2
        bg-linera-navy-light/95 backdrop-blur-sm
        rounded-full px-3 py-1.5 shadow-lg shadow-black/30
        flex items-center gap-1
        border border-linera-gray/20
        z-50
      "
    >
      {/* Draw offer received - show accept/reject */}
      {showDrawAcceptReject && (
        <>
          <div className="text-xs text-amber-400 px-2">Draw offered</div>
          <IconButton
            icon={<CheckIcon />}
            tooltip="Accept Draw"
            onClick={onAcceptDraw}
            disabled={isLoading}
            variant="success"
          />
          <IconButton
            icon={<XIcon />}
            tooltip="Decline Draw"
            onClick={onDeclineDraw}
            disabled={isLoading}
            variant="danger"
          />
          <div className="w-px h-6 bg-linera-gray/30 mx-1" />
        </>
      )}

      {/* Normal game controls */}
      {!showDrawAcceptReject && (
        <>
          {/* Resign */}
          <IconButton
            icon={<FlagIcon />}
            tooltip="Resign"
            onClick={onResign}
            disabled={!isGameActive || isLoading}
            variant="danger"
          />

          {/* Draw */}
          <IconButton
            icon={<HandshakeIcon />}
            tooltip={drawOffered ? "Draw offer pending..." : "Offer Draw"}
            onClick={onOfferDraw}
            disabled={!isGameActive || isLoading || drawOffered}
            active={drawOffered}
          />

          {/* Leave */}
          <IconButton
            icon={<DoorIcon />}
            tooltip="Leave Game"
            onClick={onLeaveGame}
            disabled={isLoading}
          />

          <div className="w-px h-6 bg-linera-gray/30 mx-1" />
        </>
      )}

      {/* Sound Toggle */}
      <IconButton
        icon={isSoundEnabled ? <SoundOnIcon /> : <SoundOffIcon />}
        tooltip={isSoundEnabled ? "Mute Sound" : "Unmute Sound"}
        onClick={onToggleSound}
        active={isSoundEnabled}
      />

      {/* Fullscreen */}
      <IconButton
        icon={<ExpandIcon />}
        tooltip="Fullscreen"
        onClick={onToggleFullscreen}
      />
    </div>
  );
}
