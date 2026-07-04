#!/usr/bin/env bash
set -euo pipefail

echo "Checking Rust toolchain..."
if ! command -v rustc &>/dev/null; then
  echo "ERROR: rustc not found. Install Rust: https://rustup.rs"
  exit 1
fi
rustc_version="$(rustc --version)"
echo "  rustc $rustc_version"
if [[ "$rustc_version" != *"nightly"* ]]; then
  echo "ERROR: Rust nightly is required for this Odra contract build."
  echo "  Install/use nightly: rustup default nightly"
  exit 1
fi

echo "Checking cargo-odra..."
if ! cargo odra --version &>/dev/null; then
  echo "ERROR: cargo-odra not found."
  echo "  Install: cargo install cargo-odra --locked"
  exit 1
fi
echo "  $(cargo odra --version)"

echo "Checking wasm target..."
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  echo "ERROR: wasm32-unknown-unknown target not installed."
  echo "  Install: rustup target add wasm32-unknown-unknown"
  exit 1
fi
echo "  wasm32-unknown-unknown installed"

echo "Checking wasm optimizer tools..."
if ! command -v wasm-opt &>/dev/null; then
  echo "ERROR: wasm-opt not found."
  echo "  Install Binaryen: brew install binaryen"
  exit 1
fi
echo "  wasm-opt $(wasm-opt --version)"

if ! command -v wasm-strip &>/dev/null; then
  echo "ERROR: wasm-strip not found."
  echo "  Install WABT: brew install wabt"
  exit 1
fi
echo "  wasm-strip $(wasm-strip --version)"

echo "Checking Casper client..."
if ! command -v casper-client &>/dev/null; then
  echo "WARN: casper-client not found. contract:build can still work, but Testnet deploy/proof submission needs casper-client."
else
  echo "  $(casper-client --version)"
fi

echo "All tooling checks passed."
