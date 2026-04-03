import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";

export const besuQbft = defineChain({
  id: 1337,
  name: "Besu QBFT",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [process.env.NEXT_PUBLIC_BESU_RPC_URL ?? "http://127.0.0.1:8545"],
    },
  },
  blockExplorers: undefined,
});

export const wagmiConfig = createConfig({
  chains: [besuQbft],
  connectors: [injected()],
  transports: {
    [besuQbft.id]: http(process.env.NEXT_PUBLIC_BESU_RPC_URL ?? "http://127.0.0.1:8545"),
  },
});
