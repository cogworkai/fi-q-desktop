#!/bin/bash
# Bumps the buildNumber (default) and optionally major, minor, or patch version, and updates gitCommit in package.json
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

# Get current buildNumber
CURRENT_BUILD=$(grep -m1 '"buildNumber"' "$PACKAGE_JSON" | sed 's/.*"buildNumber": "\([0-9][0-9]*\)".*/\1/')
if [ -z "$CURRENT_BUILD" ]; then
  echo "Error: could not read buildNumber from $PACKAGE_JSON"
  exit 1
fi

BUMP_TYPE="${1:-build}"
NEW_VERSION="$CURRENT"
NEW_BUILD=$((CURRENT_BUILD + 1))

# Bump version if requested
IFS='.' read -r MAJOR MINOR PATCH <<< "$CURRENT"
case "$BUMP_TYPE" in
  major)
    MAJOR=$((MAJOR + 1))
    MINOR=0
    PATCH=0
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  minor)
    MINOR=$((MINOR + 1))
    PATCH=0
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  patch)
    PATCH=$((PATCH + 1))
    NEW_VERSION="$MAJOR.$MINOR.$PATCH"
    ;;
  build)
    # Only bump buildNumber
    ;;
  *)
    echo "Error: Invalid bump type '$BUMP_TYPE'. Use 'major', 'minor', 'patch', or 'build'."
    exit 1
    ;;
esac

# Get current git commit hash
COMMIT=$(git -C "$(dirname "$0")/.." rev-parse --short HEAD)

# Update version in package.json
if [ "$CURRENT" != "$NEW_VERSION" ]; then
  sed -i '' "s/\"version\": \"$CURRENT\"/\"version\": \"$NEW_VERSION\"/" "$PACKAGE_JSON"
fi

# Update buildNumber in package.json
sed -i '' "s/\"buildNumber\": \"$CURRENT_BUILD\"/\"buildNumber\": \"$NEW_BUILD\"/" "$PACKAGE_JSON"

# Update gitCommit in package.json
sed -i '' "s/\"gitCommit\": \".*\"/\"gitCommit\": \"$COMMIT\"/" "$PACKAGE_JSON"

if [ "$CURRENT" != "$NEW_VERSION" ]; then
  echo "[bump_version] Bumped version: $CURRENT → $NEW_VERSION"
fi
echo "[bump_version] Bumped buildNumber: $CURRENT_BUILD → $NEW_BUILD"
echo "[bump_version] Updated gitCommit: $COMMIT"