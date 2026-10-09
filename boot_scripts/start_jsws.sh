#!/bin/bash 

#for linux platforms 

# Move to script directory 
cd "$(dirname "$0")" 
# Check for miniserve or fallback to Python 3 
if [ -f "./miniserve" ]; then 
    ./miniserve . --index index.html -p 8080 &
else python3 -m http.server 8080 &
fi 

sleep 1 
xdg-open http://localhost:8080 || sensible-browser http://localhost:8080