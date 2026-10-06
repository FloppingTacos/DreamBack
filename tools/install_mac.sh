#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
# Explicit application version avoids affecting other installed AE versions.
app_dir="${1:?Usage: bash tools/install_mac.sh '/Applications/Adobe After Effects 2026'}"
bundle=build/DreamBack.plugin
target="$app_dir/Plug-ins/DreamBack.plugin"
[[ -d "$bundle" && -d "$app_dir/Plug-ins" ]] || { echo 'Build the plugin and specify the AE application folder first.' >&2;exit 1; }
if [[ -e "$target" ]]; then
  echo "Already installed: $target. Move the existing bundle aside before replacing it." >&2;exit 1
fi
ditto "$bundle" "$target"
echo "Installed $target. Restart that version of After Effects after saving your work."
