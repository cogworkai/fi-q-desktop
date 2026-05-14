#!/bin/bash
# Wrapper script delegating to the centralized bump_version in budget
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# CENTRAL_BUMP="$SCRIPT_DIR/../../budget/app/scripts/bump_version.sh"

# if [ ! -x "$CENTRAL_BUMP" ]; then
#   echo "Error: Central bump script not found or not executable at $CENTRAL_BUMP"
#   exit 1
# fi

# "$CENTRAL_BUMP" "$@"

# Sync the build number and version from the central budget package.json
SOURCE_PACKAGE="$SCRIPT_DIR/../../budget/app/package.json"
TARGET_PACKAGE="$SCRIPT_DIR/../package.json"
echo "[bump_version.sh] Syncing from $SOURCE_PACKAGE to $TARGET_PACKAGE"

if [ -f "$SOURCE_PACKAGE" ] && [ -f "$TARGET_PACKAGE" ]; then
  OLD_VERSION=$(grep -m 1 '"version":' "$TARGET_PACKAGE" | sed -E 's/.*"version": *"([^"]+)".*/\1/')
  OLD_BUILD=$(grep -m 1 '"buildVersion":' "$TARGET_PACKAGE" | sed -E 's/.*"buildVersion": *"([^"]+)".*/\1/')

  NEW_VERSION=$(grep -m 1 '"version":' "$SOURCE_PACKAGE" | sed -E 's/.*"version": *"([^"]+)".*/\1/')
  NEW_BUILD=$(grep -m 1 '"buildVersion":' "$SOURCE_PACKAGE" | sed -E 's/.*"buildVersion": *"([^"]+)".*/\1/')
  
  if [ -n "$NEW_VERSION" ]; then
    sed -i '' -E 's/("version": *")[^"]+/\1'"$NEW_VERSION"'/' "$TARGET_PACKAGE"
  fi
  if [ -n "$NEW_BUILD" ]; then
    sed -i '' -E 's/("buildVersion": *")[^"]+/\1'"$NEW_BUILD"'/' "$TARGET_PACKAGE"
  fi
  echo "Synced version: $OLD_VERSION -> $NEW_VERSION"
  echo "Synced build number: $OLD_BUILD -> $NEW_BUILD"
else
  echo "Warning: Could not find package.json to sync versions."
fi