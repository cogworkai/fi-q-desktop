#!/bin/bash
# Publishes a GitHub release for the current version using GitHub CLI.
# Uploads DMG and ZIP build artifacts from release/.
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$SCRIPT_DIR/.."
PACKAGE_JSON="$PROJECT_DIR/package.json"
RELEASE_DIR="$PROJECT_DIR/release"

# ── Preflight checks ──────────────────────────────────────────────
if ! command -v gh &>/dev/null; then
  echo "❌ Error: GitHub CLI (gh) is not installed." >&2
  exit 1
fi

if ! gh auth status &>/dev/null; then
  echo "❌ Error: GitHub CLI is not authenticated. Run 'gh auth login' first." >&2
  exit 1
fi

if [ ! -f "$PACKAGE_JSON" ]; then
  echo "❌ Error: package.json not found at $PACKAGE_JSON" >&2
  exit 1
fi

# ── Read version from package.json ────────────────────────────────
VERSION=$(grep -m1 '"version"' "$PACKAGE_JSON" | sed 's/.*"\([0-9][0-9]*\.[0-9][0-9]*\.[0-9][0-9]*\)".*/\1/')
if [ -z "$VERSION" ]; then
  echo "❌ Error: could not read version from $PACKAGE_JSON" >&2
  exit 1
fi

TAG="v$VERSION"
echo "📦 Publishing release $TAG"

# ── Ensure working directory is clean ─────────────────────────────
cd "$PROJECT_DIR"
if [ -n "$(git status --porcelain)" ]; then
  echo "❌ Error: working directory has uncommitted changes. Commit or stash them first." >&2
  exit 1
fi

# ── Create & push git tag ─────────────────────────────────────────
if git rev-parse "$TAG" &>/dev/null; then
  echo "Tag $TAG already exists, skipping tag creation."
else
  echo "Creating tag $TAG …"
  git tag "$TAG"
  git push origin "$TAG"
fi

# ── Collect release assets ────────────────────────────────────────
ASSETS=()
DMG="$RELEASE_DIR/Fi Q.dmg"
ZIP="$RELEASE_DIR/Fi Q.zip"

if [ -f "$DMG" ]; then
  ASSETS+=("$DMG")
  echo "  ✓ Found DMG"
else
  echo "  ⚠ DMG not found at $DMG"
fi

if [ -f "$ZIP" ]; then
  ASSETS+=("$ZIP")
  echo "  ✓ Found ZIP"
else
  echo "  ⚠ ZIP not found at $ZIP"
fi

if [ ${#ASSETS[@]} -eq 0 ]; then
  echo "❌ Error: no release assets found in $RELEASE_DIR" >&2
  exit 1
fi

# ── Create GitHub release ─────────────────────────────────────────
echo "Creating GitHub release …"
gh release create "$TAG" \
  --title "$VERSION" \
  --generate-notes \
  "${ASSETS[@]}"

echo "✅ Release $TAG published successfully!"
echo "   https://github.com/cogworkai/fi-q-desktop/releases/tag/$TAG"
