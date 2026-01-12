"use client";

import { TimeControl, TIME_CONTROLS, TimeControlCategory } from "@/types/game";

interface QueueCount {
  [key: string]: number;
}

interface TimeControlGridProps {
  queueCounts?: QueueCount;
  onSelect: (timeControl: TimeControl) => void;
  disabled?: boolean;
}

const getCategoryStyles = (category: TimeControlCategory): string => {
  switch (category) {
    case "bullet":
      return "bg-orange-500 hover:bg-orange-600 text-white";
    case "blitz":
      return "bg-yellow-500 hover:bg-yellow-600 text-gray-900";
    case "rapid":
      return "bg-green-500 hover:bg-green-600 text-white";
    default:
      return "bg-gray-500 hover:bg-gray-600 text-white";
  }
};

const getCategoryIcon = (category: TimeControlCategory): string => {
  switch (category) {
    case "bullet":
      return ""; // Lightning bolt representation
    case "blitz":
      return ""; // Fire representation
    case "rapid":
      return ""; // Clock representation
    default:
      return "";
  }
};

const getCategoryLabel = (category: TimeControlCategory): string => {
  switch (category) {
    case "bullet":
      return "Bullet";
    case "blitz":
      return "Blitz";
    case "rapid":
      return "Rapid";
    default:
      return "";
  }
};

export default function TimeControlGrid({
  queueCounts = {},
  onSelect,
  disabled = false,
}: TimeControlGridProps) {
  const timeControls = Object.entries(TIME_CONTROLS) as [
    TimeControl,
    (typeof TIME_CONTROLS)[TimeControl]
  ][];

  return (
    <div className="w-full">
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">
        Select Time Control
      </h3>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {timeControls.map(([timeControl, metadata]) => {
          const queueCount = queueCounts[timeControl] || 0;

          return (
            <button
              key={timeControl}
              onClick={() => onSelect(timeControl)}
              disabled={disabled}
              className={`
                relative p-4 rounded-xl transition-all duration-200
                transform hover:scale-105 active:scale-95
                shadow-md hover:shadow-lg
                ${getCategoryStyles(metadata.category)}
                ${disabled ? "opacity-50 cursor-not-allowed hover:scale-100" : "cursor-pointer"}
              `}
            >
              {/* Queue count badge */}
              {queueCount > 0 && (
                <div className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold rounded-full w-6 h-6 flex items-center justify-center shadow-md">
                  {queueCount > 99 ? "99+" : queueCount}
                </div>
              )}

              {/* Category icon */}
              <div className="text-2xl mb-1">
                {getCategoryIcon(metadata.category)}
              </div>

              {/* Time label */}
              <div className="text-xl font-bold">{metadata.label}</div>

              {/* Category label */}
              <div className="text-xs opacity-80 mt-1">
                {getCategoryLabel(metadata.category)}
              </div>

              {/* Minutes description */}
              <div className="text-xs opacity-70 mt-0.5">
                {metadata.minutes} min
                {metadata.increment > 0 && ` +${metadata.increment}s`}
              </div>
            </button>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-orange-500"></span>
          <span className="text-gray-600">Bullet</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
          <span className="text-gray-600">Blitz</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-green-500"></span>
          <span className="text-gray-600">Rapid</span>
        </div>
      </div>
    </div>
  );
}
