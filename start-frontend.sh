#!/bin/bash
export PATH="/usr/local/bin:$PATH"
cd "$(dirname "$0")/frontend"
exec npm run dev
