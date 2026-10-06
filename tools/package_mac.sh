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
echo 'Packaged output/DreamBack-0.1-mac.zip'
