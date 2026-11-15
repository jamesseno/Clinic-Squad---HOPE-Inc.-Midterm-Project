#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."
npx --yes supabase@latest db push --remote "$@"