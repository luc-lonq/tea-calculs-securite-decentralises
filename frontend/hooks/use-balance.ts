import { useQuery } from "@tanstack/react-query";
import { useAccount, usePublicClient } from "wagmi";
import { formatEther } from "viem";

export function useBalance() {
  const { address } = useAccount();
  const publicClient = usePublicClient();

  const { data: balance } = useQuery({
    queryKey: ["balance", address],
    queryFn: async () => {
      if (!address || !publicClient) return null;
      const bal = await publicClient.getBalance({ address });
      return formatEther(bal);
    },
    refetchInterval: 2000,
  });

  return balance;
}
