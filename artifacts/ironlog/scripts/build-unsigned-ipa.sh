#!/bin/bash
#
# Build an unsigned iOS IPA for local packaging.
#
# This script intentionally does not use EAS, Apple credentials, automatic
# provisioning, sideloading tools, or iCloud. The resulting IPA is only a
# package containing an unsigned .app. It must be signed separately before it
# can run on a physical iPhone.
#
# Usage:
#   ./scripts/build-unsigned-ipa.sh
#

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_ROOT="$(dirname "$SCRIPT_DIR")"
IOS_DIR="$APP_ROOT/ios"
IPA_OUT="$APP_ROOT/IronLog-unsigned.ipa"

TEMP_ROOT="$(mktemp -d "${TMPDIR:-/tmp}/ironlog-unsigned.XXXXXX")"
DERIVED_DATA_DIR="$TEMP_ROOT/DerivedData"
BUILD_DIR="$DERIVED_DATA_DIR/Build/Products/Release-iphoneos"
APP_BUNDLE="$BUILD_DIR/IronLog.app"
BUNDLE_TMP="$TEMP_ROOT/main.jsbundle"
ASSETS_TMP="$TEMP_ROOT/assets"
XCODEBUILD_LOG="$TEMP_ROOT/xcodebuild.log"
BUNDLE_LOG="$TEMP_ROOT/bundle.log"

cleanup() {
  rm -rf "$TEMP_ROOT"
}
trap cleanup EXIT

log()  { printf "\033[36m[build-unsigned-ipa]\033[0m %s\n" "$*"; }
warn() { printf "\033[33m[build-unsigned-ipa] warn:\033[0m %s\n" "$*" >&2; }
err()  { printf "\033[31m[build-unsigned-ipa] error:\033[0m %s\n" "$*" >&2; exit 1; }

command -v node >/dev/null 2>&1 || err "Node.js is required."
command -v xcodebuild >/dev/null 2>&1 || err "xcodebuild is required. Run this script on macOS with Xcode installed."
command -v zip >/dev/null 2>&1 || err "zip is required."

if [ ! -d "$IOS_DIR" ]; then
  log "ios/ not found. Generating the native iOS project..."
  (
    cd "$APP_ROOT"
    if command -v pnpm >/dev/null 2>&1; then
      pnpm exec expo prebuild --platform ios
    else
      npx expo prebuild --platform ios
    fi
  )
fi

[ -d "$IOS_DIR" ] || err "ios/ could not be generated."

WORKSPACE="$IOS_DIR/IronLog.xcworkspace"
PROJECT="$IOS_DIR/IronLog.xcodeproj"

if [ -f "$WORKSPACE/contents.xcworkspacedata" ]; then
  XCODE_CONTAINER=(-workspace "IronLog.xcworkspace")
elif [ -d "$PROJECT" ]; then
  warn "IronLog.xcworkspace not found; using IronLog.xcodeproj."
  XCODE_CONTAINER=(-project "IronLog.xcodeproj")
else
  err "Neither IronLog.xcworkspace nor IronLog.xcodeproj was found."
fi

START="$(date +%s)"

# These resource bundles are copied as a fallback for the same Expo/CocoaPods
# resource-phase issue handled by the original update-ipa.sh script.
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

log "Building the native app without code signing..."
log "  Output streams to $XCODEBUILD_LOG"

# CODE_SIGNING_ALLOWED=NO and CODE_SIGNING_REQUIRED=NO prevent Xcode from
# requesting an Apple account, certificates, or provisioning profiles.
set +e
(
  cd "$IOS_DIR"
  xcodebuild \
    "${XCODE_CONTAINER[@]}" \
    -scheme IronLog \
    -configuration Release \
    -sdk iphoneos \
    -derivedDataPath "$DERIVED_DATA_DIR" \
    CODE_SIGNING_ALLOWED=NO \
    CODE_SIGNING_REQUIRED=NO \
    CODE_SIGN_IDENTITY="" \
    build
) >"$XCODEBUILD_LOG" 2>&1
XCODEBUILD_STATUS=$?
set -e

# Expo's React Native bundle phase can fail independently under pnpm hoisting.
# The original script handled that case by checking whether the .app exists;
# retain the same behavior while still failing when no native app was created.
[ -d "$APP_BUNDLE" ] || {
  if [ "$XCODEBUILD_STATUS" -ne 0 ]; then
    err "xcodebuild did not produce IronLog.app. See $XCODEBUILD_LOG"
  fi
  err "xcodebuild completed without producing IronLog.app. See $XCODEBUILD_LOG"
}

if [ "$XCODEBUILD_STATUS" -ne 0 ]; then
  warn "xcodebuild returned status $XCODEBUILD_STATUS, but IronLog.app exists; continuing with the manual JavaScript bundle."
fi

log "Copying pod resource bundles into the app..."
for bundle in "${POD_BUNDLES[@]}"; do
  src="$BUILD_DIR/$bundle"
  name="$(basename "$bundle")"
  if [ -d "$src" ]; then
    rm -rf "$APP_BUNDLE/$name"
    cp -R "$src" "$APP_BUNDLE/"
  else
    warn "$bundle not found in build artifacts; skipped"
  fi
done

# Embed the dynamic frameworks the app links against (React, Hermes, etc.).
# xcodebuild's React Native bundle phase can fail under pnpm *before* the
# "[CP] Embed Pods Frameworks" phase runs, leaving IronLog.app/Frameworks/
# empty. The app then builds an .app that crashes instantly at launch with
# dyld: "Library not loaded: @rpath/React.framework/React". Copy the prebuilt
# frameworks in manually, mirroring Pods-IronLog-frameworks.sh.
log "Embedding dynamic frameworks into the app..."
XCFRAMEWORK_DIR="$BUILD_DIR/XCFrameworkIntermediates"
FRAMEWORKS_DEST="$APP_BUNDLE/Frameworks"
mkdir -p "$FRAMEWORKS_DEST"
embedded_count=0
if [ -d "$XCFRAMEWORK_DIR" ]; then
  while IFS= read -r -d '' fw; do
    name="$(basename "$fw")"
    rm -rf "$FRAMEWORKS_DEST/$name"
    cp -R "$fw" "$FRAMEWORKS_DEST/"
    log "  Embedded $name"
    embedded_count=$((embedded_count + 1))
  done < <(find "$XCFRAMEWORK_DIR" -type d -name '*.framework' -prune -print0)
fi
[ "$embedded_count" -gt 0 ] || err "No dynamic frameworks were embedded; the app would crash at launch with a dyld 'Library not loaded' error. See $XCODEBUILD_LOG"

log "Bundling JavaScript..."
rm -f "$BUNDLE_TMP"
rm -rf "$ASSETS_TMP"

ENTRY_FILE="$(
  cd "$APP_ROOT"
  node -e "require('expo/scripts/resolveAppEntry')" "$APP_ROOT" ios absolute | tail -n 1
)"
[ -n "$ENTRY_FILE" ] || err "Could not resolve the Expo app entry file."

(
  cd "$APP_ROOT"
  if command -v pnpm >/dev/null 2>&1; then
    pnpm exec expo export:embed \
      --platform ios \
      --dev false \
      --reset-cache \
      --entry-file "$ENTRY_FILE" \
      --bundle-output "$BUNDLE_TMP" \
      --assets-dest "$ASSETS_TMP"
  else
    npx expo export:embed \
      --platform ios \
      --dev false \
      --reset-cache \
      --entry-file "$ENTRY_FILE" \
      --bundle-output "$BUNDLE_TMP" \
      --assets-dest "$ASSETS_TMP"
  fi
) >"$BUNDLE_LOG" 2>&1 || err "JavaScript bundle failed. See $BUNDLE_LOG"

[ -f "$BUNDLE_TMP" ] || err "The JavaScript bundle was not created. See $BUNDLE_LOG"

log "Injecting JavaScript and assets into the app..."
cp "$BUNDLE_TMP" "$APP_BUNDLE/main.jsbundle"

if [ -d "$ASSETS_TMP/assets" ]; then
  rm -rf "$APP_BUNDLE/assets"
  cp -R "$ASSETS_TMP/assets" "$APP_BUNDLE/"
fi

log "Removing any residual signatures and provisioning profiles..."
find "$APP_BUNDLE" -type d -name _CodeSignature -prune -exec rm -rf {} +
find "$APP_BUNDLE" -type f \( -name embedded.mobileprovision -o -name embedded.provisionprofile \) -delete

log "Packaging unsigned IPA..."
PACKAGE_DIR="$TEMP_ROOT/package"
PAYLOAD_DIR="$PACKAGE_DIR/Payload"
mkdir -p "$PAYLOAD_DIR"
cp -R "$APP_BUNDLE" "$PAYLOAD_DIR/"
rm -f "$IPA_OUT"
(
  cd "$PACKAGE_DIR"
  zip -qr "$IPA_OUT" Payload
)

[ -f "$IPA_OUT" ] || err "IPA packaging failed."

SIZE="$(du -h "$IPA_OUT" | cut -f1)"
ELAPSED=$(( $(date +%s) - START ))

echo
log "Done in ${ELAPSED}s. IronLog-unsigned.ipa ($SIZE)"
log "Local: $IPA_OUT"
log "The IPA is unsigned and must be signed before installation on an iPhone."
echo
