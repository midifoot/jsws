#!/bin/bash

# for linux platforms

# Move to the jsws app root directory (parent of boot_scripts)
cd "$(dirname "$0")/.."

# Check for miniserve or fallback to Python 3
if [ -x "./miniserve" ]; then
    ./miniserve . --index index.html -p 8080 &
elif [ -x "../miniserve-0.35.0-x86_64-unknown-linux-gnu" ]; then
    ../miniserve-0.35.0-x86_64-unknown-linux-gnu . --index index.html -p 8080 &
else
    python3 -m http.server 8080 &
fi

sleep 1
xdg-open http://localhost:8080 || sensible-browser http://localhost:8080
