#!/bin/bash
# Bumps the major, minor, or patch version and updates git_commit in package.json
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

BUMP_TYPE="${1:-patch}"

# Bump version
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    ;;
  patch)
    PATCH=$((PATCH + 1))
    ;;
  *)
    echo "Error: Invalid bump type '$BUMP_TYPE'. Use 'major', 'minor', or 'patch'."
    exit 1
    ;;
esac
NEW_VERSION="$MAJOR.$MINOR.$PATCH"

# Get current git commit hash
COMMIT=$(git -C "$(dirname "$0")/.." rev-parse --short HEAD)

# Update version in package.json
sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"

# Update gitCommit in package.json
sed -i '' "s/\"gitCommit\": \".*\"/\"gitCommit\": \"$COMMIT\"/" "$PACKAGE_JSON"

echo "[bump_version] Bumped version: $CURRENT → $NEW_VERSION"
echo "[bump_version] Updated gitCommit: $COMMIT"