#!/bin/bash
set -e

# Configuration
REPO="mattyatea/git-conflict-mcp" # Replace with your repository
BINARY_NAME="git-conflict-mcp"
INSTALL_DIR="/usr/local/bin"

# Detect OS and Arch
OS="$(uname -s)"
ARCH="$(uname -m)"

case "$OS" in
    Linux)  PLATFORM="linux" ;;
    Darwin) PLATFORM="darwin" ;;
    *)      echo "Unsupported OS: $OS"; exit 1 ;;
esac

case "$ARCH" in
    x86_64) ARCH="x64" ;;
    arm64|aarch64) ARCH="arm64" ;;
    *)      echo "Unsupported Architecture: $ARCH"; exit 1 ;;
esac

ASSET_NAME="${BINARY_NAME}-${PLATFORM}-${ARCH}"

echo "Detected platform: $PLATFORM-$ARCH"
echo "Looking for asset: $ASSET_NAME"

# Get latest release download URL
# Uses GitHub API to find the asset URL for the current platform
DOWNLOAD_URL=$(curl -s "https://api.github.com/repos/$REPO/releases/latest" | \
    grep "browser_download_url" | \
    grep "$ASSET_NAME" | \
    cut -d '"' -f 4)

if [ -z "$DOWNLOAD_URL" ]; then
    echo "Error: Could not find download URL for $ASSET_NAME in latest release of $REPO"
    echo "Available assets might not match your platform."
    exit 1
fi

echo "Downloading from: $DOWNLOAD_URL"

# Download
curl -L -o "$BINARY_NAME" "$DOWNLOAD_URL"

# Make executable
chmod +x "$BINARY_NAME"

# macOS specific handling
if [ "$PLATFORM" == "darwin" ]; then
    echo "Applying macOS fixes (xattr -rc)..."
    xattr -rc "$BINARY_NAME"
fi

echo "Installation complete. You can move the binary to your path, e.g.:"
echo "sudo mv $BINARY_NAME $INSTALL_DIR/"
