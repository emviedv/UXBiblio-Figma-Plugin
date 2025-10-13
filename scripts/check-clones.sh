#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

JSCOPD_BIN="${REPO_ROOT}/node_modules/.bin/jscpd"
REPORT_DIR="${REPO_ROOT}/reports/jscpd"
REPORT_JSON="${REPORT_DIR}/jscpd-report.json"
THRESHOLD="${CLONE_THRESHOLD:-4}"

if [[ ! -x "${JSCOPD_BIN}" ]]; then
  echo "❌ jscpd binary not found at ${JSCOPD_BIN}. Install dependencies before running clone checks." >&2
  exit 1
fi

mkdir -p "${REPORT_DIR}"

ARGS=(
  "--mode"
  "strict"
  "--reporters"
  "json"
  "--output"
  "${REPORT_DIR}"
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

IGNORE_FILE="${REPO_ROOT}/clones.config.json"
if [[ -f "${IGNORE_FILE}" ]]; then
  ARGS+=("--config" "${IGNORE_FILE}")
fi

echo "▶️  Running blocking jscpd scan..."
set +e
"${JSCOPD_BIN}" "${ARGS[@]}" "${REPO_ROOT}"
EXIT_CODE=$?
set -e

if [[ -f "${REPORT_JSON}" ]]; then
  node "${SCRIPT_DIR}/format-jscpd-report.mjs" "${REPORT_JSON}"
else
  echo "⚠️  Expected jscpd report was not generated at ${REPORT_JSON}." >&2
fi

exit "${EXIT_CODE}"
