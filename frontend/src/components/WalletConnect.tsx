"use client";

import { useWalletStore } from "@/store/wallet";

export default function WalletConnect() {
  const {
    chainId,
    playerId,
    ready,
    getDisplayPlayerId,
  } = useWalletStore();

  const isConnected = ready && !!chainId;
  const displayPlayerId = getDisplayPlayerId();

  if (isConnected) {
    return (
      <div className="flex items-center space-x-2">
        <div className="px-4 py-2 bg-green-100 rounded-lg flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
          <span className="text-sm text-green-800 font-medium">
            {displayPlayerId || "Connected"}
          </span>
        </div>
      </div>
    );
  }

  // Disconnected state - show connecting indicator
  return (
    <div className="flex items-center space-x-2">
      <div className="px-4 py-2 bg-gray-100 rounded-lg flex items-center gap-2">
        <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
        <span className="text-sm text-gray-600">Connecting...</span>
      </div>
    </div>
  );
}
