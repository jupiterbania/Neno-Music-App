#!/bin/bash
REAL_CMAKE_BIN=$(which -a cmake | grep -v cmake-bin | head -n 1)
if [[ "$*" == *"--build"* ]]; then
  exec "$REAL_CMAKE_BIN" "$@"
else
  exec "$REAL_CMAKE_BIN" -DCMAKE_POLICY_VERSION_MINIMUM=3.5 "$@"
fi
