#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

JSCOPD_BIN="${REPO_ROOT}/node_modules/.bin/jscpd"

if [[ ! -x "${JSCOPD_BIN}" ]]; then
  echo "⚠️  jscpd binary not found at ${JSCOPD_BIN}. Install dependencies before running this script."
  exit 0
fi

IGNORE_FILE="${REPO_ROOT}/clones.config.json"
THRESHOLD="${CLONE_THRESHOLD:-4}"

ARGS=(
  "--mode"
  "strict"
  "--reporters"
  "console"
  "--threshold"
  "${THRESHOLD}"
  "--gitignore"
  "--ignore"
  "**/node_modules/**"
  "--ignore"
  "**/dist/**"
  "--ignore"
  "**/coverage/**"
  "--ignore"
  "**/reports/**"
)

if [[ -f "${IGNORE_FILE}" ]]; then
  ARGS+=("--config" "${IGNORE_FILE}")
fi

echo "▶️  Running jscpd console report (non-blocking)..."
"${JSCOPD_BIN}" "${ARGS[@]}" "${REPO_ROOT}" || true
echo "✅ jscpd console scan completed (results above are informational)."
