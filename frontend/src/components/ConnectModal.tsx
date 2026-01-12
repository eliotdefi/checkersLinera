"use client";

import { useState } from "react";

// Get default chain ID from environment
const DEFAULT_CHAIN_ID = process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || "";

interface ConnectModalProps {
  isOpen: boolean;
  onConnect: (chain: string, port: string) => void;
  defaultPort?: string;
}

export default function ConnectModal({
  isOpen,
  onConnect,
  defaultPort = "8081",
}: ConnectModalProps) {
  const [chainId, setChainId] = useState(DEFAULT_CHAIN_ID);
  const [port, setPort] = useState(defaultPort);
  const [isConnecting, setIsConnecting] = useState(false);

  if (!isOpen) return null;

  const handleConnect = async () => {
    if (!chainId.trim()) return;

    setIsConnecting(true);
    try {
      onConnect(chainId.trim(), port.trim() || defaultPort);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-8 max-w-md w-full mx-4 shadow-2xl">
        <h2 className="text-2xl font-bold text-gray-800 mb-2 text-center">
          Connect to Linera
        </h2>
        <p className="text-gray-600 text-center mb-6">
          Enter your chain ID and port to connect
        </p>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="chainId"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Chain ID
            </label>
            <input
              id="chainId"
              type="text"
              value={chainId}
              onChange={(e) => setChainId(e.target.value)}
              placeholder="Enter your Chain ID"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>

          <div>
            <label
              htmlFor="port"
              className="block text-sm font-medium text-gray-700 mb-1"
            >
              Port
            </label>
            <input
              id="port"
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="8081"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              onKeyDown={(e) => e.key === "Enter" && handleConnect()}
            />
          </div>

          <button
            onClick={handleConnect}
            disabled={!chainId.trim() || isConnecting}
            className="w-full px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium text-lg"
          >
            {isConnecting ? "Connecting..." : "Connect"}
          </button>
        </div>
      </div>
    </div>
  );
}
