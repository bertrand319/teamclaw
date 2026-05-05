#!/bin/bash
set -euo pipefail

OSS_BASE="https://teamclaw.ucar.cc"
APP_NAME="TeamClaw"
MOUNT_POINT="/Volumes/${APP_NAME}"

echo "Installing ${APP_NAME} (国内镜像)..."

# Get latest version from OSS
VERSION=$(curl -sL "${OSS_BASE}/releases/latest.txt")
if [ -z "$VERSION" ]; then
  echo "Error: Could not fetch latest version from OSS"
  exit 1
fi
VERSION_NUM="${VERSION#v}"
echo "Latest version: ${VERSION}"

# Detect architecture
ARCH=$(uname -m)
case "$ARCH" in
  arm64)
    DMG_NAME="TeamClaw_${VERSION_NUM}_aarch64.dmg"
    echo "Detected Apple Silicon (arm64)"
    ;;
  x86_64)
    DMG_NAME="TeamClaw_${VERSION_NUM}_x64.dmg"
    echo "Detected Intel (x86_64)"
    ;;
  *)
    echo "Error: Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

DMG_URL="${OSS_BASE}/releases/${VERSION}/${DMG_NAME}"
echo "Downloading from: ${DMG_URL}"
DMG_FILE=$(mktemp /tmp/teamclaw-XXXXXX.dmg)
curl -L --progress-bar -o "$DMG_FILE" "$DMG_URL"

# Unmount if already mounted
if [ -d "$MOUNT_POINT" ]; then
  hdiutil detach "$MOUNT_POINT" -quiet 2>/dev/null || true
fi

echo "Mounting DMG..."
hdiutil attach "$DMG_FILE" -quiet -nobrowse

# Find .app in mounted volume
APP_PATH=$(find "$MOUNT_POINT" -maxdepth 1 -name "*.app" -type d | head -1)
if [ -z "$APP_PATH" ]; then
  echo "Error: No .app found in DMG"
  hdiutil detach "$MOUNT_POINT" -quiet
  rm -f "$DMG_FILE"
  exit 1
fi

# Close app if running
if pgrep -x "$APP_NAME" >/dev/null 2>&1; then
  echo "Closing running ${APP_NAME}..."
  osascript -e "tell application \"${APP_NAME}\" to quit" 2>/dev/null || true
  sleep 2
fi

echo "Installing to /Applications..."
rm -rf "/Applications/${APP_NAME}.app"
cp -R "$APP_PATH" /Applications/

# Remove quarantine attribute
xattr -dr com.apple.quarantine "/Applications/${APP_NAME}.app" 2>/dev/null || true

# Cleanup
hdiutil detach "$MOUNT_POINT" -quiet
rm -f "$DMG_FILE"

echo ""
echo "${APP_NAME} installed successfully!"
echo "Opening ${APP_NAME}..."
open "/Applications/${APP_NAME}.app"
