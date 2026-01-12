"use client";

import { useEffect, type ReactNode } from "react";
import { useWalletStore } from "@/store/wallet";

function WalletInitializer({ children }: { children: ReactNode }) {
  const init = useWalletStore((state) => state.init);

  useEffect(() => {
    init();
  }, [init]);

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return <WalletInitializer>{children}</WalletInitializer>;
}
