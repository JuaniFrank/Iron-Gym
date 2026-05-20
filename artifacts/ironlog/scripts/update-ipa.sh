#!/bin/bash
#
# Build IronLog.ipa for AltStore sideload.
#
#   ./scripts/update-ipa.sh           # JS-only update (~30s)
#   ./scripts/update-ipa.sh --full    # Full native rebuild (~5-10 min)
#
# Default mode reuses the IronLog.app from the last full build, swapping in a
# fresh JS bundle. Use --full when:
#   - First run after a clean clone (no ios/build yet)
#   - You added/removed an Expo plugin in app.json
#   - You bumped a native dep (expo-*, react-native-*, etc.)
#   - You changed app.json fields that affect Info.plist (bundle id, scheme,
#     capabilities, permissions strings)
#   - You ran `expo prebuild --clean` and regenerated ios/
#
# --full automatically runs `expo prebuild --platform ios --no-install` +
# `pod install` before xcodebuild. Ambos son idempotentes así que cuestan
# casi nada cuando no hay cambios; cuando los hay, son lo que ata todo.
#
# After the script finishes, .ipa lands at the project root and (if iCloud
# Drive exists) at iCloud Drive root. Sideload: AltStore → My Apps → + →
# select IronLog.ipa.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(dirname "$SCRIPT_DIR")"
IOS_DIR="$APP_ROOT/ios"
BUILD_DIR="$IOS_DIR/build/Build/Products/Release-iphoneos"
APP_BUNDLE="$BUILD_DIR/IronLog.app"
IPA_OUT="$APP_ROOT/IronLog.ipa"
BUNDLE_TMP="/tmp/ironlog-bundle.jsbundle"
ASSETS_TMP="/tmp/ironlog-assets"
ICLOUD_DEFAULT="$HOME/Library/Mobile Documents/com~apple~CloudDocs"
XCODEBUILD_LOG="/tmp/ironlog-xcodebuild.log"
BUNDLE_LOG="/tmp/ironlog-bundle.log"

# These pods declare resource bundles that the IronLog target's
# `[CP] Copy Pods Resources` build phase is supposed to copy into the .app.
# In practice that phase doesn't always run when the bundle script fails
# earlier, so we re-do its job by hand. List comes from
# `Pods/Target Support Files/Pods-IronLog/Pods-IronLog-resources.sh`.
POD_BUNDLES=(
  "EXConstants/EXConstants.bundle"
  "EXConstants/ExpoConstants_privacy.bundle"
  "ExpoFileSystem/ExpoFileSystem_privacy.bundle"
  "ExpoSystemUI/ExpoSystemUI_privacy.bundle"
  "RNSVG/RNSVGFilters.bundle"
  "React-Core/React-Core_privacy.bundle"
  "React-cxxreact/React-cxxreact_privacy.bundle"
  "SDWebImage/SDWebImage.bundle"
)

MODE="js-only"
[ "${1:-}" = "--full" ] && MODE="full"

log()  { printf "\033[36m[update-ipa]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[update-ipa] warn:\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[31m[update-ipa] error:\033[0m %s\n" "$*" >&2; exit 1; }

[ -d "$IOS_DIR" ] || err "ios/ not found. Run: pnpm exec expo prebuild --platform ios"

if [ "$MODE" = "js-only" ] && [ ! -d "$APP_BUNDLE" ]; then
  log "No previous build at $APP_BUNDLE. Auto-switching to --full."
  MODE="full"
fi

START=$(date +%s)

# ---------------------------------------------------------------------------
# Full native rebuild
# ---------------------------------------------------------------------------
if [ "$MODE" = "full" ]; then
  # Regenerate ios/ from app.json and re-resolve pods. Ambos son idempotentes
  # — si no cambiaron app.json ni las deps nativas, son casi instantáneos.
  # Si SÍ cambiaron (ej. agregamos un plugin de Expo o un módulo nativo) este
  # paso es lo único que evita un .ipa silenciosamente roto en runtime.
  log "Regenerating ios/ via expo prebuild..."
  ( cd "$APP_ROOT" && pnpm exec expo prebuild --platform ios --no-install ) \
    > /tmp/ironlog-prebuild.log 2>&1 \
    || err "expo prebuild failed. See /tmp/ironlog-prebuild.log"

  log "Installing CocoaPods..."
  ( cd "$IOS_DIR" && pod install ) > /tmp/ironlog-pod-install.log 2>&1 \
    || err "pod install failed. See /tmp/ironlog-pod-install.log"

  log "Full rebuild via xcodebuild..."
  log "  Output streams to $XCODEBUILD_LOG"

  # The "Bundle React Native code and images" phase fails inside xcodebuild
  # due to pnpm hoisting (`Cannot find module 'babel-preset-expo'`). We
  # bundle JS manually below, so we don't care about that phase. Other
  # phases (compile, codegen, embed frameworks, signing) complete cleanly.
  # `set +e` so the failed exit doesn't kill us — we verify success by
  # checking the .app exists below.
  set +e
  ( cd "$IOS_DIR" && xcodebuild \
      -workspace IronLog.xcworkspace \
      -scheme IronLog \
      -configuration Release \
      -sdk iphoneos \
      -derivedDataPath build \
      -allowProvisioningUpdates \
      CODE_SIGN_STYLE=Automatic \
      build ) > "$XCODEBUILD_LOG" 2>&1
  set -e

  [ -d "$APP_BUNDLE" ] || err "xcodebuild produced no IronLog.app. See $XCODEBUILD_LOG"

  log "Copying pod resource bundles into .app..."
  for bundle in "${POD_BUNDLES[@]}"; do
    src="$BUILD_DIR/$bundle"
    name=$(basename "$bundle")
    if [ -d "$src" ]; then
      rm -rf "${APP_BUNDLE:?}/$name"
      cp -R "$src" "$APP_BUNDLE/"
    else
      warn "  $bundle not found in build artifacts; skipped"
    fi
  done
fi

# ---------------------------------------------------------------------------
# Bundle JS (always)
# ---------------------------------------------------------------------------
log "Bundling JS via expo export:embed (--reset-cache)..."
rm -f "$BUNDLE_TMP"
rm -rf "$ASSETS_TMP"

# Auto-detect entry file. With expo-router this resolves to the entry shim
# inside the resolved expo-router package (path varies under pnpm).
ENTRY_FILE=$(cd "$APP_ROOT" && node -e "require('expo/scripts/resolveAppEntry')" "$APP_ROOT" ios absolute | tail -n 1)
[ -n "$ENTRY_FILE" ] || err "Could not resolve app entry file."

( cd "$APP_ROOT" && npx expo export:embed \
    --platform ios \
    --dev false \
    --reset-cache \
    --entry-file "$ENTRY_FILE" \
    --bundle-output "$BUNDLE_TMP" \
    --assets-dest "$ASSETS_TMP" ) > "$BUNDLE_LOG" 2>&1 \
    || err "JS bundle failed. See $BUNDLE_LOG"

[ -f "$BUNDLE_TMP" ] || err "Bundle command succeeded but $BUNDLE_TMP is missing."

# Sanity: bundle is JS source, NOT Hermes bytecode. Hermes bytecode would
# crash on TurboModule init in our setup (cf. memory: altstore-sideload-flow).
# JS source starts with var __BUNDLE_START_TIME__ etc.
HEAD_BYTES=$(head -c 4 "$BUNDLE_TMP" | xxd -p)
if [ "$HEAD_BYTES" = "c61fbc03" ]; then
  err "Bundle is Hermes bytecode. We need JS source — use plain expo export:embed without bytecode."
fi

# ---------------------------------------------------------------------------
# Inject bundle + assets into .app
# ---------------------------------------------------------------------------
log "Injecting JS + assets into IronLog.app..."
cp "$BUNDLE_TMP" "$APP_BUNDLE/main.jsbundle"

if [ -d "$ASSETS_TMP/assets" ]; then
  rm -rf "$APP_BUNDLE/assets"
  cp -R "$ASSETS_TMP/assets" "$APP_BUNDLE/"
fi

# ---------------------------------------------------------------------------
# Package as .ipa
# ---------------------------------------------------------------------------
log "Packaging .ipa..."
PAYLOAD_TMP="$BUILD_DIR/Payload"
rm -rf "$PAYLOAD_TMP" "$IPA_OUT"
mkdir -p "$PAYLOAD_TMP"
cp -R "$APP_BUNDLE" "$PAYLOAD_TMP/"
( cd "$BUILD_DIR" && zip -qr "$IPA_OUT" Payload )
rm -rf "$PAYLOAD_TMP"

# ---------------------------------------------------------------------------
# Optional: copy to iCloud Drive root for easy AltStore pickup
# ---------------------------------------------------------------------------
if [ -d "$ICLOUD_DEFAULT" ]; then
  cp "$IPA_OUT" "$ICLOUD_DEFAULT/IronLog.ipa"
  log "Copied to iCloud Drive."
fi

# ---------------------------------------------------------------------------
# Summary
# ---------------------------------------------------------------------------
SIZE=$(du -h "$IPA_OUT" | cut -f1)
ELAPSED=$(( $(date +%s) - START ))
echo
log "✓ Done in ${ELAPSED}s. IronLog.ipa ($SIZE)"
log "  Local:  $IPA_OUT"
[ -d "$ICLOUD_DEFAULT" ] && log "  iCloud: $ICLOUD_DEFAULT/IronLog.ipa"
echo

# AltStore on the phone needs AltServer running on this Mac to discover it
# over WiFi. Ensure it's up so the "+" import doesn't fail with "no server
# found".
if pgrep -x AltServer >/dev/null 2>&1; then
  log "AltServer ya está corriendo."
elif [ -d "/Applications/AltServer.app" ]; then
  log "Abriendo AltServer..."
  open -ga AltServer
else
  warn "AltServer.app no está en /Applications. Instalalo desde https://altstore.io o el sideload va a fallar con 'no server found'."
fi

log "Next: AltStore on iPhone → My Apps → '+' → select IronLog.ipa"
