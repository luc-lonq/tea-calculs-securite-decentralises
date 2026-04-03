"use client";

import { useRouter } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { type Address } from "viem";
import { useAccount, usePublicClient, useReadContract, useSwitchChain, useWriteContract } from "wagmi";
import { besuQbft } from "@/lib/wagmi";
import { veridegreeAbi, veridegreeAddress } from "@/lib/veridegree";
import { useAddBesuChain } from "@/hooks/use-add-besu-chain";

type DiplomaMetadata = {
  name?: string;
  description?: string;
  file?: string;
};

type AdminDiploma = {
  tokenId: bigint;
  owner: Address;
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

export function AdminView() {
  const router = useRouter();
  const { address, chainId, isConnected } = useAccount();
  const publicClient = usePublicClient({ chainId: besuQbft.id });
  const { switchChain } = useSwitchChain();
  const { mutateAsync: writeContractAsync, isPending } = useWriteContract();
  const addBesuChain = useAddBesuChain();

  const [recipient, setRecipient] = useState<string>("");
  const [diplomaName, setDiplomaName] = useState<string>("");
  const [diplomaDescription, setDiplomaDescription] = useState<string>("");
  const [lookupAddress, setLookupAddress] = useState<string>("");
  const [adminDiplomas, setAdminDiplomas] = useState<AdminDiploma[]>([]);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [status, setStatus] = useState<string>("");

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
      return;
    }

    if (isConnected && chainId !== besuQbft.id) {
      addBesuChain().catch(() => {
        // user can switch manually
      });
    }
  }, [isConnected, chainId, addBesuChain, router]);

  useEffect(() => {
    if (!isConnected || !address || !minterRole || isAdmin === undefined) return;
    if (!isAdmin) {
      router.replace("/student");
    }
  }, [isConnected, address, minterRole, isAdmin, router]);

  const currentRecipient = useMemo(
    () => (recipient.trim() || address || "") as Address | "",
    [recipient, address],
  );

  const currentLookupAddress = useMemo(
    () => lookupAddress.trim() as Address | "",
    [lookupAddress],
  );

  async function readDiploma(tokenId: bigint): Promise<AdminDiploma> {
    if (!publicClient) {
      throw new Error("Client RPC indisponible.");
    }

    const owner = (await publicClient.readContract({
      address: veridegreeAddress,
      abi: veridegreeAbi,
      functionName: "ownerOf",
      args: [tokenId],
    })) as Address;

    const tokenUri = (await publicClient.readContract({
      address: veridegreeAddress,
      abi: veridegreeAbi,
      functionName: "tokenURI",
      args: [tokenId],
    })) as string;

    const metadata = await readMetadata(tokenUri);
    const pdfUrl = metadata?.file ? ipfsToHttp(metadata.file) : undefined;
    return { tokenId, owner, tokenUri, metadata, pdfUrl };
  }

  async function loadAllDiplomas() {
    if (!publicClient) return;

    try {
      setStatus("Lecture de tous les diplômes...");
      const totalMinted = (await publicClient.readContract({
        address: veridegreeAddress,
        abi: veridegreeAbi,
        functionName: "totalMinted",
      })) as bigint;

      const diplomas: AdminDiploma[] = [];
      for (let tokenId = BigInt(1); tokenId <= totalMinted; tokenId++) {
        diplomas.push(await readDiploma(tokenId));
      }

      setAdminDiplomas(diplomas);
      setStatus(`Chargement admin terminé (${diplomas.length} diplôme(s)).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lecture admin: ${message}`);
    }
  }

  async function loadDiplomasByAddress() {
    if (!publicClient) return;
    if (!currentLookupAddress) {
      setStatus("Adresse à rechercher invalide.");
      return;
    }

    try {
      setStatus("Lecture des diplômes pour l'adresse demandée...");
      const ownerBalance = (await publicClient.readContract({
        address: veridegreeAddress,
        abi: veridegreeAbi,
        functionName: "balanceOf",
        args: [currentLookupAddress],
      })) as bigint;

      const diplomas: AdminDiploma[] = [];
      for (let i = BigInt(0); i < ownerBalance; i++) {
        const tokenId = (await publicClient.readContract({
          address: veridegreeAddress,
          abi: veridegreeAbi,
          functionName: "tokenOfOwnerByIndex",
          args: [currentLookupAddress, i],
        })) as bigint;

        diplomas.push(await readDiploma(tokenId));
      }

      setAdminDiplomas(diplomas);
      setStatus(`Chargement admin terminé (${diplomas.length} diplôme(s)).`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Erreur inconnue";
      setStatus(`Erreur lecture admin: ${message}`);
    }
  }

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

    if (!diplomaName.trim()) {
      setStatus("Indique un nom pour le diplôme.");
      return;
    }

    if (!diplomaDescription.trim()) {
      setStatus("Indique une description pour le diplôme.");
      return;
    }

    try {
      setStatus("Upload du PDF vers IPFS...");
      const pdfCid = await uploadToIpfs(pdfFile, pdfFile.name);

      setStatus("Upload des métadonnées JSON vers IPFS...");
      const metadata = {
        name: diplomaName.trim(),
        description: diplomaDescription.trim(),
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

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 py-8">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">VeriDegree — Admin</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">Besu QBFT - Contract: {veridegreeAddress}</p>
        </div>
        <ConnectButton showBalance={false} chainStatus={'none'} />
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
        <h2 className="text-xl font-medium">Mint diplôme</h2>
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
            Nom du diplôme
            <input
              value={diplomaName}
              onChange={(event) => setDiplomaName(event.target.value)}
              placeholder="Master Informatique"
              className="rounded-md border border-zinc-300 bg-transparent px-3 py-2 dark:border-zinc-700"
            />
          </label>

          <label className="grid gap-1 text-sm">
            Description du diplôme
            <textarea
              value={diplomaDescription}
              onChange={(event) => setDiplomaDescription(event.target.value)}
              placeholder="Diplôme délivré à l'étudiant après validation du parcours"
              rows={3}
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
            {isPending ? "Upload en cours..." : "Uploader"}
          </button>
        </form>
      </section>

      <section className="grid gap-4 rounded-lg border border-zinc-200 p-4 dark:border-zinc-800">
        <h2 className="text-xl font-medium">Consultation admin</h2>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={loadAllDiplomas}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Voir tous les diplômes
          </button>

          <input
            value={lookupAddress}
            onChange={(event) => setLookupAddress(event.target.value)}
            placeholder="0x..."
            className="min-w-[280px] flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          />

          <button
            type="button"
            onClick={loadDiplomasByAddress}
            className="rounded-md border border-zinc-300 px-4 py-2 text-sm font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
          >
            Voir cette adresse
          </button>
        </div>

        <div className="grid gap-4">
          {adminDiplomas.map((token) => (
            <article
              key={token.tokenId.toString()}
              className="rounded-lg border border-zinc-200 p-4 text-sm dark:border-zinc-800"
            >
              <p className="font-medium">Token #{token.tokenId.toString()}</p>
              <p className="break-all text-zinc-600 dark:text-zinc-400">Owner: {token.owner}</p>
              <p className="break-all text-zinc-600 dark:text-zinc-400">Metadata: {token.tokenUri}</p>

              {token.metadata?.name ? <p className="mt-2">Titre: {token.metadata.name}</p> : null}
              {token.metadata?.description ? (
                <p className="text-zinc-600 dark:text-zinc-400">Description: {token.metadata.description}</p>
              ) : null}

              {token.pdfUrl ? (
                <a href={token.pdfUrl} target="_blank" rel="noreferrer" className="mt-3 inline-block underline">
                  Ouvrir le PDF dans un nouvel onglet
                </a>
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
