# VeriDegree — Diplômes Académiques Soulbound

A Web3 lab project. Mint non-transferable diplomas (Soulbound Tokens) on Besu QBFT. Store PDFs on IPFS. Built with Solidity, Foundry, Next.js, and Wagmi.

Spec: Admin mints diplomas (name + PDF). Student sees only their own. Everything lives on-chain or on IPFS.


## How it works

Admin creates a form: recipient address, diploma name, description, PDF file.

Frontend uploads PDF to IPFS, gets a CID. Creates metadata JSON with name, description, and file CID. Uploads JSON to IPFS, gets another CID.

Calls `mint(recipient, "ipfs://cid-of-metadata")` on the contract.

Student connects wallet. Sees only their own diplomas. Click one -> metadata + PDF rendered in an iframe.

---

## Prerequisites

- Node 18+, npm
- Foundry (`foundryup` to install)
- IPFS Kubo (`go-ipfs`)
- MetaMask or any wallet

/!\ Require a Besu Network to work.

Verify RPC:

```bash
cast chain-id --rpc-url http://127.0.0.1:8545
```

### 2. Start IPFS

Set CORS headers (required for frontend to upload):

```bash
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Origin '["http://localhost:3000"]'
ipfs config --json API.HTTPHeaders.Access-Control-Allow-Methods '["PUT", "POST", "GET"]'
ipfs daemon
```

API on `:5001`, gateway on `:8080`.

### 3. Deploy contract to Besu (with explicit roles)

```bash
cd contracts/
cp .env.example .env
# edit .env and set PRIVATE_KEY, VERIDEGREE_ADMIN, VERIDEGREE_MINTER

source .env
forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  --legacy
```

Note the contract address. Then set it in your frontend env:

```bash
cd ../frontend
cp .env.local.example .env.local 2>/dev/null || true
# set NEXT_PUBLIC_VERIDEGREE_ADDRESS and NEXT_PUBLIC_BESU_RPC_URL
```

### 4. Start frontend

```bash
cd frontend/
npm i
npm run dev
```

Open http://localhost:3000. Connect MetaMask to Besu QBFT (RPC: your node URL, Chain: 1337).

## Smart contract

See `contracts/src/VeriDegree.sol`. It's an ERC721 that:

- Blocks transfers after mint (Soulbound). Override of `_update()` checks `_ownerOf(tokenId) != address(0)` and reverts.
- Restricts minting to `MINTER_ROLE` (AccessControl).
- Stores IPFS URIs as tokenURI.

```bash
forge build
forge test -v
```

## Frontend

Next.js + Wagmi + RainbowKit. Two pages:

- `/admin` — Admin-only. Mint form (recipient, name, description, PDF). Auto-redirects if you don't have MINTER_ROLE.
- `/student` — Student-only. Shows only your diplomas. PDF preview with iframe.

Config in `frontend/lib/wagmi.ts` and `frontend/lib/veridegree.ts`.

## Deploy (Besu only)

Use `contracts/.env` and the deployment script:

```bash
cd contracts/
source .env

forge script script/Deploy.s.sol \
  --rpc-url "$RPC_URL" \
  --broadcast \
  --private-key "$PRIVATE_KEY" \
  --legacy
```

Role behavior in `Deploy.s.sol`:
- `VERIDEGREE_ADMIN` receives `DEFAULT_ADMIN_ROLE`
- `VERIDEGREE_MINTER` receives `MINTER_ROLE`
- `VERIDEGREE_REVOKE_DEPLOYER_ROLES=true` removes admin/minter roles from deployer after grants

## Test

```bash
cd contracts/
forge test -v
```