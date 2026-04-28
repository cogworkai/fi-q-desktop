#!/bin/bash
# Wrapper script delegating to the centralized bump_version in budget
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CENTRAL_BUMP="$SCRIPT_DIR/../../budget/app/scripts/bump_version.sh"

if [ ! -x "$CENTRAL_BUMP" ]; then
  echo "Error: Central bump script not found or not executable at $CENTRAL_BUMP"
  exit 1
fi

"$CENTRAL_BUMP" "$@"