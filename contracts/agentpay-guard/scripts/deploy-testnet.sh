#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../../.." && pwd)"
CONTRACT_DIR="$ROOT/contracts/agentpay-guard"
WASM_PATH="$CONTRACT_DIR/wasm/AgentPayProofRecorder.wasm"

if [ -f "$ROOT/.env" ]; then
  set -a
  # shellcheck disable=SC1091
  source "$ROOT/.env"
  set +a
fi

CASPER_NETWORK="${CASPER_NETWORK:-casper-test}"
CASPER_RPC_URL="${CASPER_RPC_URL:-https://node.testnet.casper.network/rpc}"
CASPER_DEPLOY_GAS_MOTES="${CASPER_DEPLOY_GAS_MOTES:-500000000000}"

missing=()
if [ -z "${CASPER_TESTNET_SECRET_KEY_PATH:-}" ]; then
  missing+=("CASPER_TESTNET_SECRET_KEY_PATH")
fi
if [ -z "${CASPER_TESTNET_PUBLIC_KEY:-}" ]; then
  missing+=("CASPER_TESTNET_PUBLIC_KEY")
fi

if [ "${#missing[@]}" -gt 0 ]; then
  echo "Cannot deploy AgentPayProofRecorder to Casper Testnet."
  echo "Missing required environment variables:"
  for name in "${missing[@]}"; do
    echo "  - $name"
  done
  echo ""
  echo "Setup:"
  echo "  1. Copy .env.example to .env."
  echo "  2. Set CASPER_TESTNET_SECRET_KEY_PATH to an absolute funded Testnet key path."
  echo "  3. Set CASPER_TESTNET_PUBLIC_KEY to the matching public key hex."
  echo "  4. Optional: set CASPER_RPC_URL and CASPER_DEPLOY_GAS_MOTES."
  echo "  5. Run pnpm contract:build, then pnpm contract:deploy:testnet."
  exit 1
fi

if [ ! -f "$CASPER_TESTNET_SECRET_KEY_PATH" ]; then
  echo "Cannot deploy AgentPayProofRecorder to Casper Testnet."
  echo "CASPER_TESTNET_SECRET_KEY_PATH does not point to a readable file."
  echo "Path configured: $CASPER_TESTNET_SECRET_KEY_PATH"
  exit 1
fi

if [ ! -f "$WASM_PATH" ]; then
  echo "Contract wasm artifact is missing: $WASM_PATH"
  echo "Run pnpm contract:build before deploying."
  exit 1
fi

if ! command -v casper-client >/dev/null 2>&1; then
  echo "Cannot deploy AgentPayProofRecorder to Casper Testnet."
  echo "casper-client is not installed."
  echo "Install it, then re-run pnpm contract:deploy:testnet."
  exit 1
fi

set +e
account_output="$(
  casper-client get-account \
    --node-address "$CASPER_RPC_URL" \
    --public-key "$CASPER_TESTNET_PUBLIC_KEY" 2>&1
)"
account_status=$?
set -e

if [ "$account_status" -ne 0 ]; then
  if printf '%s\n' "$account_output" | grep -qi "No such account"; then
    echo "Cannot deploy AgentPayProofRecorder to Casper Testnet."
    echo "The configured Testnet account does not exist on-chain yet."
    echo ""
    echo "Public key:"
    echo "  $CASPER_TESTNET_PUBLIC_KEY"
    echo ""
    echo "Fund this account with Casper Testnet tokens, then re-run:"
    echo "  pnpm contract:deploy:testnet"
    echo ""
    echo "Faucet:"
    echo "  https://testnet.cspr.live/tools/faucet"
    echo ""
    echo "Note: the CSPR.live faucet requires signing in with Casper Wallet."
    exit 1
  fi

  echo "Cannot deploy AgentPayProofRecorder to Casper Testnet."
  echo "Could not confirm the configured account on Casper Testnet."
  echo "$account_output"
  exit "$account_status"
fi

echo "Deploying AgentPayProofRecorder to Casper Testnet..."
echo "Network: $CASPER_NETWORK"
echo "RPC URL: $CASPER_RPC_URL"
echo "Wasm:    $WASM_PATH"
echo ""

set +e
output="$(
  casper-client put-deploy \
    --node-address "$CASPER_RPC_URL" \
    --secret-key "$CASPER_TESTNET_SECRET_KEY_PATH" \
    --chain-name "$CASPER_NETWORK" \
    --payment-amount "$CASPER_DEPLOY_GAS_MOTES" \
    --session-path "$WASM_PATH" \
    --session-arg "odra_cfg_package_hash_key_name:string='agentpay_proof_recorder_package_hash'" \
    --session-arg "odra_cfg_allow_key_override:bool='true'" \
    --session-arg "odra_cfg_is_upgradable:bool='true'" \
    --session-arg "odra_cfg_is_upgrade:bool='false'" 2>&1
)"
status=$?
set -e

if [ "$status" -ne 0 ]; then
  echo "Casper deploy failed. No fake deploy hash was generated."
  echo "$output"
  exit "$status"
fi

echo "$output"
deploy_hash="$(printf '%s\n' "$output" | grep -Eo '[0-9a-fA-F]{64}' | tail -n 1 || true)"

if [ -n "$deploy_hash" ]; then
  echo ""
  echo "Deployment deploy hash: $deploy_hash"
  echo "CSPR.live: https://testnet.cspr.live/deploy/$deploy_hash"
  echo ""
  echo "After the deploy is executed, copy the resulting contract hash/package hash into .env:"
  echo "  CASPER_AGENTPAY_CONTRACT_HASH=<contract-hash-from-execution-result>"
  echo "  CASPER_AGENTPAY_CONTRACT_PACKAGE_HASH=<package-hash-from-execution-result>"
else
  echo ""
  echo "Deploy command completed, but no deploy hash was found in output."
  echo "Inspect the output above before updating .env."
fi
