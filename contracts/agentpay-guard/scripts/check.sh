#!/usr/bin/env bash
set -euo pipefail

echo "Checking Rust toolchain..."
if ! command -v rustc &>/dev/null; then
  echo "ERROR: rustc not found. Install Rust: https://rustup.rs"
  exit 1
fi
echo "  rustc $(rustc --version)"

echo "Checking cargo-odra..."
if ! command -v cargo-odra &>/dev/null; then
  echo "ERROR: cargo-odra not found."
  echo "  Install: cargo install cargo-odra --locked"
  exit 1
fi
echo "  cargo-odra $(cargo-odra --version)"

echo "Checking wasm target..."
if ! rustup target list --installed | grep -q wasm32-unknown-unknown; then
  echo "ERROR: wasm32-unknown-unknown target not installed."
  echo "  Install: rustup target add wasm32-unknown-unknown"
  exit 1
fi
echo "  wasm32-unknown-unknown installed"

echo "All tooling checks passed."
