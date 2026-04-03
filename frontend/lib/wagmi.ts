import { createConfig, http, injected } from "wagmi";
import { defineChain } from "viem";
import { anvil } from "wagmi/chains";

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

export const supportedChains = [anvil, besuQbft] as const;

export const appChain =
  process.env.NEXT_PUBLIC_DEFAULT_CHAIN === "anvil" ? anvil : besuQbft;

export const wagmiConfig = createConfig({
  chains: supportedChains,
  connectors: [injected()],
  transports: {
    [anvil.id]: http(process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545"),
    [besuQbft.id]: http(process.env.NEXT_PUBLIC_BESU_RPC_URL ?? "http://127.0.0.1:8545"),
  },
});
