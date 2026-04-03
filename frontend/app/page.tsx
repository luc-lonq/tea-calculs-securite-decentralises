"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAccount, useReadContract } from "wagmi";
import { veridegreeAbi, veridegreeAddress } from "@/lib/veridegree";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Home() {
  const router = useRouter();
  const { address, isConnected } = useAccount();

  const { data: minterRole } = useReadContract({
    address: veridegreeAddress,
    abi: veridegreeAbi,
    functionName: "MINTER_ROLE",
  });

  const { data: isAdmin } = useReadContract({
    address: veridegreeAddress,
    abi: veridegreeAbi,
    functionName: "hasRole",
    args: minterRole && address ? [minterRole, address] : undefined,
    query: {
      enabled: Boolean(isConnected && address && minterRole),
    },
  });

  useEffect(() => {
    if (!isConnected || !address || !minterRole || isAdmin === undefined) return;
    router.replace(isAdmin ? "/admin" : "/student");
  }, [isConnected, address, minterRole, isAdmin, router]);

  return (
    <main className="mx-auto flex min-h-[calc(100vh-80px)] w-full max-w-3xl flex-1 items-center justify-center px-6 py-10">
      <section className="flex w-full max-w-xl flex-col items-center gap-6 rounded-xl border border-zinc-200 px-8 py-10 text-center dark:border-zinc-800">
        <h1 className="text-3xl font-semibold">VeriDegree</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Connecte ton wallet pour être redirigé automatiquement vers la bonne vue.
        </p>
        <div className="flex justify-center">
          <ConnectButton showBalance={false} chainStatus={"none"} />
        </div>
      </section>
    </main>
  );
}
