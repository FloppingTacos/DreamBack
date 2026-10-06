#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ -z "${AE_SDK_ROOT:-}" || ! -f "$AE_SDK_ROOT/Examples/Headers/AE_Effect.h" ]]; then
  echo 'Set AE_SDK_ROOT to the extracted SDK folder containing Examples/Headers/AE_Effect.h.' >&2
  exit 1
fi
stage=$(mktemp -d "${TMPDIR:-/tmp}/dreamback-build.XXXXXX")
trap 'rm -rf "$stage"' EXIT
# Sign outside synced workspaces: macOS File Provider can immediately restore
# FinderInfo attributes on .plugin directories and make codesign fail.
bundle="$stage/DreamBack.plugin"
mkdir -p "$bundle/Contents/MacOS" "$bundle/Contents/Resources"
inc=(-I"$AE_SDK_ROOT/Examples/Headers" -I"$AE_SDK_ROOT/Examples/Headers/SP" -I"$AE_SDK_ROOT/Examples/Util")
xcrun clang++ -std=c++17 -O2 -Wall -Wextra -Wno-pragma-pack -fvisibility=hidden -arch arm64 -arch x86_64 -mmacosx-version-min=12.0 -bundle "${inc[@]}" src/ae/DreamBack.cpp src/core/Feedback.cpp -o "$bundle/Contents/MacOS/DreamBack"
xcrun Rez -useDF -d __MACH__ -i "$AE_SDK_ROOT/Examples/Headers" -i "$AE_SDK_ROOT/Examples/Resources" -i src/ae src/ae/DreamBack.r -o "$bundle/Contents/Resources/DreamBack.rsrc"
cp src/ae/Info.plist "$bundle/Contents/Info.plist"
xattr -cr "$bundle"
codesign --force --sign - "$bundle"
codesign --verify --deep --strict "$bundle"
file "$bundle/Contents/MacOS/DreamBack"
mkdir -p build
ditto --noextattr --norsrc "$bundle" build/DreamBack.plugin
xattr -dr com.apple.FinderInfo build/DreamBack.plugin 2>/dev/null || true
codesign --verify --deep --strict build/DreamBack.plugin
echo "Built build/DreamBack.plugin (ad-hoc signed, not notarized)"
