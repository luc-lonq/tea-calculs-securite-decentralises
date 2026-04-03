import { useCallback } from "react";
import { besuQbft } from "@/lib/wagmi";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
};

export function useAddBesuChain() {
  return useCallback(async () => {
    const ethereum = (window as Window & { ethereum?: EthereumProvider }).ethereum;

    if (!ethereum) {
      throw new Error("MetaMask not found");
    }

    try {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [
          {
            chainId: `0x${besuQbft.id.toString(16)}`,
            chainName: besuQbft.name,
            rpcUrls: [besuQbft.rpcUrls.default.http[0]],
            nativeCurrency: {
              name: besuQbft.nativeCurrency.name,
              symbol: besuQbft.nativeCurrency.symbol,
              decimals: besuQbft.nativeCurrency.decimals,
            },
          },
        ],
      });
      return true;
    } catch (error) {
      if ((error as { code?: number }).code === 4001) {
        throw new Error("User rejected adding chain");
      }
      throw error;
    }
  }, []);
}
