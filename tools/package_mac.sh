#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -d build/DreamBack.plugin ]] || { echo 'Build the plugin first.' >&2;exit 1; }
package=output/DreamBack-0.1-mac
mkdir -p "$package/demo" "$package/docs"
ditto --noextattr --norsrc build/DreamBack.plugin "$package/DreamBack.plugin"
cp README.md "$package/README.md"
cp demo/DreamBack_Demo.jsx "$package/demo/"
cp docs/VALIDATION.md docs/SDK_NOTES.md "$package/docs/"
ditto -c -k --noextattr --norsrc --keepParent "$package" output/DreamBack-0.1-mac.zip
verify_dir=$(mktemp -d "${TMPDIR:-/tmp}/dreamback-package.XXXXXX")
trap 'rm -rf "$verify_dir"' EXIT
ditto -x -k output/DreamBack-0.1-mac.zip "$verify_dir"
codesign --verify --deep --strict "$verify_dir/DreamBack-0.1-mac/DreamBack.plugin"
echo 'Packaged output/DreamBack-0.1-mac.zip'
