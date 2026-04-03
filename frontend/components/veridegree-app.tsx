"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { type Address } from "viem";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { besuQbft } from "@/lib/wagmi";
import { veridegreeAbi, veridegreeAddress } from "@/lib/veridegree";
import { useAddBesuChain } from "@/hooks/use-add-besu-chain";
import { useBalance } from "@/hooks/use-balance";

type StudentToken = {
  tokenId: bigint;
  tokenUri: string;
};

function ipfsToHttp(uri: string) {
  if (!uri.startsWith("ipfs://")) return uri;
  const cid = uri.replace("ipfs://", "");
  return `http://127.0.0.1:8080/ipfs/${cid}`;
}

async function uploadToIpfs(blob: Blob, fileName: string) {
  const formData = new FormData();
  formData.append("file", blob, fileName);

  const response = await fetch("http://127.0.0.1:5001/api/v0/add?pin=true", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`IPFS upload failed (${response.status})`);
  }

  const text = await response.text();
  const lines = text.trim().split("\n");
  const last = lines[lines.length - 1];
  const parsed = JSON.parse(last) as { Hash: string };
  return parsed.Hash;
}

export function VeriDegreeApp() {
  const { address, chainId, isConnected } = useAccount();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: besuQbft.id });
  const { writeContractAsync, isPending } = useWriteContract();
  const addBesuChain = useAddBesuChain();
  const balance = useBalance();

  const [recipient, setRecipient] = useState<string>("");
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");
  const [viewerAddress, setViewerAddress] = useState<string>("");
  const [studentTokens, setStudentTokens] = useState<StudentToken[]>([]);

  useEffect(() => {
    if (isConnected && chainId !== besuQbft.id) {
      addBesuChain().catch(() => {
        // Silently fail, user can click button manually
      });
    }
  }, [isConnected, chainId, addBesuChain]);

  const currentRecipient = useMemo(
    () => (recipient.trim() || address || "") as Address | "",
    [recipient, address],
  );

  const currentViewer = useMemo(
    () => (viewerAddress.trim() || address || "") as Address | "",
    [viewerAddress, address],
  );

  const { data: totalMinted } = useReadContract({
    address: veridegreeAddress,
    abi: veridegreeAbi,
    functionName: "totalMinted",
    query: { refetchInterval: 4000 },
  });

  async function handleMint(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isConnected || !address) {
      setStatus("Connecte ton wallet d'abord.");
      return;
    }

    if (!currentRecipient) {
      setStatus("Adresse destinataire invalide.");
      return;
    }

    if (!pdfFile) {
      setStatus("Sélectionne un PDF avant de mint.");
      return;
    }

    try {
      setStatus("Upload du PDF vers IPFS...");
      const pdfCid = await uploadToIpfs(pdfFile, pdfFile.name);

      setStatus("Upload des métadonnées JSON vers IPFS...");
      const metadata = {
        name: "VeriDegree Diploma",
        description: "Academic diploma stored on IPFS and minted as Soulbound NFT",
        file: `ipfs://${pdfCid}`,
      };

      const metadataBlob = new Blob([JSON.stringify(metadata)], {
        type: "application/json",
      });
      const metadataCid = await uploadToIpfs(metadataBlob, `metadata-${Date.now()}.json`);
      const tokenUri = `ipfs://${metadataCid}`;

      setStatus("Envoi de la transaction mint...");
      const hash = await writeContractAsync({
        address: veridegreeAddress,
        abi: veridegreeAbi,
        functionName: "mint",
        args: [currentRecipient, tokenUri],
        chainId: besuQbft.id,
      });

      setStatus(`Mint envoyé. Tx: ${hash}`);
      setPdfFile(null);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur: ${message}`);
    }
  }

  async function loadStudentTokens() {
    if (!publicClient) return;
    if (!currentViewer) {
      setStatus("Adresse étudiant invalide.");
      return;
    }

    try {
      setStatus("Lecture des diplômes étudiant...");
      const balance = (await publicClient.readContract({
        address: veridegreeAddress,
        abi: veridegreeAbi,
        functionName: "balanceOf",
        args: [currentViewer],
      })) as bigint;

      const tokens: StudentToken[] = [];
      for (let i = BigInt(0); i < balance; i++) {
        const tokenId = (await publicClient.readContract({
          address: veridegreeAddress,
          abi: veridegreeAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [currentViewer, i],
        })) as bigint;

        const tokenUri = (await publicClient.readContract({
          address: veridegreeAddress,
          abi: veridegreeAbi,
          functionName: "tokenURI",
          args: [tokenId],
        })) as string;

        tokens.push({ tokenId, tokenUri });
      }

      setStudentTokens(tokens);
      setStatus(`Chargement terminé (${tokens.length} diplôme(s)).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lecture étudiant: ${message}`);
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">VeriDegree</h1>
            Besu QBFT • Contract: {veridegreeAddress}
            <p>
          {isConnected && address && (
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Compte: {address.slice(0, 6)}...{address.slice(-4)} • Balance: {balance ?? "..."} ETH
            </p>
          )}
            </p>
        </div>
        <ConnectButton />
      </header>
      {chainId !== besuQbft.id ? (
        <section className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
          <p className="mb-3 text-sm">Wallet connecté sur un autre réseau. Passe sur Besu QBFT (1337).</p>
          <button
            type="button"
            onClick={() => switchChain({ chainId: besuQbft.id })}
            className="rounded-md border border-zinc-300 px-3 py-2 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Switch to Besu QBFT
          </button>
        </section>
      ) : null}

      <section className="grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xl font-medium">Admin — Mint diplôme</h2>
        <form className="grid gap-3" onSubmit={handleMint}>
          <label className="grid gap-1 text-sm">
            Adresse étudiant
            <input
              value={recipient}
              onChange={(event) => setRecipient(event.target.value)}
              placeholder={address ?? "0x..."}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>

          <label className="grid gap-1 text-sm">
            PDF du diplôme
            <input
              type="file"
              accept="application/pdf"
              onChange={(event) => setPdfFile(event.target.files?.[0] ?? null)}
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>

          <button
            type="submit"
            disabled={isPending}
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 disabled:opacity-50 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            {isPending ? "Mint en cours..." : "Uploader + Mint"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xl font-medium">Étudiant — Mes diplômes</h2>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            value={viewerAddress}
            onChange={(event) => setViewerAddress(event.target.value)}
            placeholder={address ?? "0x..."}
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />
          <button
            type="button"
            onClick={loadStudentTokens}
            className="w-fit rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Charger
          </button>
        </div>

        <p className="text-sm text-zinc-600 dark:text-zinc-400">
          Total mintés: {totalMinted ? totalMinted.toString() : "0"}
        </p>

        <ul className="grid gap-2">
          {studentTokens.map((token) => (
            <li
              key={token.tokenId.toString()}
              className="rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800"
            >
              <p>Token #{token.tokenId.toString()}</p>
              <p className="break-all text-zinc-600 dark:text-zinc-400">{token.tokenUri}</p>
              <a
                href={ipfsToHttp(token.tokenUri)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-block underline"
              >
                Ouvrir metadata IPFS
              </a>
            </li>
          ))}
        </ul>
      </section>

      {status ? (
        <section className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800">{status}</section>
      ) : null}
    </main>
  );
}
