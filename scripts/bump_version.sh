#!/bin/bash
# Bumps the patch version and updates git_commit in package.json
set -e

PACKAGE_JSON="$(dirname "$0")/../package.json"

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "Error: package.json not found at $PACKAGE_JSON"
  exit 1
fi

# Get current version
CURRENT=$(grep -m1 '"version"' "$PACKAGE_JSON" | sed 's/.*"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/')
if [ -z "$CURRENT" ]; then
  echo "Error: could not read version from $PACKAGE_JSON"
  exit 1
fi

# Bump patch
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
NEW_VERSION="$MAJOR.$MINOR.$((PATCH + 1))"

# Get current git commit hash
COMMIT=$(git -C "$(dirname "$0")/.." rev-parse --short HEAD)

# Update version in package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"

# Update gitCommit in package.json
sed -i '' "s/\"gitCommit\": \".*\"/\"gitCommit\": \"$COMMIT\"/" "$PACKAGE_JSON"

echo "[bump_version] Bumped version: $CURRENT → $NEW_VERSION"
echo "[bump_version] Updated gitCommit: $COMMIT"