"use client";

import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useEffect, useState } from "react";
import { useAccount, usePublicClient, useReadContract } from "wagmi";
import { veridegreeAbi, veridegreeAddress } from "@/lib/veridegree";
import { besuQbft } from "@/lib/wagmi";

type DiplomaMetadata = {
  name?: string;
  description?: string;
  file?: string;
};

type StudentDiploma = {
  tokenId: bigint;
  tokenUri: string;
  metadata?: DiplomaMetadata;
  pdfUrl?: string;
};

function ipfsToHttp(uri: string) {
  if (!uri.startsWith("ipfs://")) return uri;
  const cid = uri.replace("ipfs://", "");
  return `http://127.0.0.1:8080/ipfs/${cid}`;
}

async function readMetadata(tokenUri: string): Promise<DiplomaMetadata | undefined> {
  const metadataResponse = await fetch(ipfsToHttp(tokenUri));
  if (!metadataResponse.ok) {
    return undefined;
  }
  return (await metadataResponse.json()) as DiplomaMetadata;
}

export function StudentView() {
  const router = useRouter();
  const { address, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: besuQbft.id });

  const [status, setStatus] = useState<string>("");
  const [studentTokens, setStudentTokens] = useState<StudentDiploma[]>([]);

  const { data: totalMinted } = useReadContract({
    address: veridegreeAddress,
    abi: veridegreeAbi,
    functionName: "totalMinted",
    query: { refetchInterval: 4000 },
  });

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
    if (!isConnected) {
      router.replace("/");
    }
  }, [isConnected, router]);

  useEffect(() => {
    if (!isConnected || !address || !minterRole || isAdmin === undefined) return;
    if (isAdmin) {
      router.replace("/admin");
    }
  }, [isConnected, address, minterRole, isAdmin, router]);

  async function loadStudentDiplomas() {
    if (!publicClient) return;
    if (!address) {
      setStatus("Wallet non connecté.");
      return;
    }

    try {
      setStatus("Lecture des diplômes étudiant...");
      const ownerBalance = (await publicClient.readContract({
        address: veridegreeAddress,
        abi: veridegreeAbi,
        functionName: "balanceOf",
        args: [address],
      })) as bigint;

      const diplomas: StudentDiploma[] = [];
      for (let i = BigInt(0); i < ownerBalance; i++) {
        const tokenId = (await publicClient.readContract({
          address: veridegreeAddress,
          abi: veridegreeAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [address, i],
        })) as bigint;

        const tokenUri = (await publicClient.readContract({
          address: veridegreeAddress,
          abi: veridegreeAbi,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;

        const metadata = await readMetadata(tokenUri);
        const pdfUrl = metadata?.file ? ipfsToHttp(metadata.file) : undefined;

        diplomas.push({ tokenId, tokenUri, metadata, pdfUrl });
      }

      setStudentTokens(diplomas);
      setStatus(`Chargement terminé (${diplomas.length} diplôme(s)).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lecture étudiant: ${message}`);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">VeriDegree — Étudiant</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Besu QBFT - Contract: {veridegreeAddress}</p>
        </div>
        <ConnectButton showBalance={false} chainStatus={'none'} />
      </header>

      <section className="grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xl font-medium">Mes diplômes</h2>

        <button
          type="button"
          onClick={loadStudentDiplomas}
          className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
        >
          Charger mes diplômes
        </button>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Total mintés: {totalMinted ? totalMinted.toString() : "0"}
        </p>

        <div className="grid gap-4">
          {studentTokens.map((token) => (
            <article
              key={token.tokenId.toString()}
              className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
            >
              <p className="font-medium">Token #{token.tokenId.toString()}</p>
              <p className="break-all text-zinc-600 dark:text-zinc-400">Metadata: {token.tokenUri}</p>

              {token.metadata?.name ? <p className="mt-2">Titre: {token.metadata.name}</p> : null}
              {token.metadata?.description ? (
                <p className="text-zinc-600 dark:text-zinc-400">Description: {token.metadata.description}</p>
              ) : null}

              {token.pdfUrl ? (
                <div className="mt-3 space-y-2">
                  <a href={token.pdfUrl} target="_blank" rel="noreferrer" className="inline-block underline">
                    Ouvrir le PDF dans un nouvel onglet
                  </a>
                  <iframe
                    src={token.pdfUrl}
                    title={`Diploma ${token.tokenId.toString()}`}
                    className="h-[70vh] w-full rounded-md border border-zinc-200 dark:border-zinc-800"
                  />
                </div>
              ) : (
                <p className="mt-2 text-zinc-600 dark:text-zinc-400">
                  PDF introuvable dans les métadonnées IPFS pour ce diplôme.
                </p>
              )}
            </article>
          ))}
        </div>
      </section>

      {status ? (
        <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">{status}</section>
      ) : null}
    </main>
  );
}
