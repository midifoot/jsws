#!/bin/bash 
# for macOS platforms 

# Move to script directory 
cd "$(dirname "$0")" 
# Check if miniserve binary exists, otherwise fallback to Python 
if [ -f "./miniserve" ]; then 
    ./miniserve . --index index.html -p 8080 &
else python3 -m http.server 8080 &
fi 

sleep 1 
open http://localhost:8080