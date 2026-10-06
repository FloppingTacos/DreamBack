#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
: "${AE_SDK_ROOT:?Set AE_SDK_ROOT to the folder containing Examples}"
mkdir -p build
xcrun clang++ -std=c++17 -O1 -g -Wno-pragma-pack -fsanitize=address,undefined -I"$AE_SDK_ROOT/Examples/Headers" -I"$AE_SDK_ROOT/Examples/Headers/SP" -I"$AE_SDK_ROOT/Examples/Util" tests/ae_adapter_tests.cpp src/core/Feedback.cpp -o build/ae_adapter_tests
./build/ae_adapter_tests
