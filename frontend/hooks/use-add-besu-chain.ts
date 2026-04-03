import { useCallback } from "react";
import { usePublicClient } from "wagmi";
import { besuQbft } from "@/lib/wagmi";

export function useAddBesuChain() {
  const publicClient = usePublicClient();

  return useCallback(async () => {
    if (!window.ethereum) {
      throw new Error("MetaMask not found");
    }

    try {
      await window.ethereum.request({
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
      if ((error as any).code === 4001) {
        throw new Error("User rejected adding chain");
      }
      throw error;
    }
  }, [publicClient]);
}
