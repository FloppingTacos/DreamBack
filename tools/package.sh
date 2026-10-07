#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
[[ -f output/panel/DreamBack.jsx ]] || { echo 'Run node tools/build.mjs first.' >&2;exit 1; }
mkdir -p output/panel/docs
cp README.md output/panel/README.md
cp docs/VALIDATION.md docs/SOURCES.md output/panel/docs/
ditto -c -k --noextattr --norsrc --keepParent output/panel output/DreamBack-0.2-panel.zip
echo 'Packaged output/DreamBack-0.2-panel.zip'
