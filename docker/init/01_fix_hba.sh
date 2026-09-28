#!/bin/bash
# Runs once on first DB init — rewrites pg_hba.conf to trust all connections.
# Needed because Docker Desktop on Windows NATs connections so they don't
# appear as 127.0.0.1 inside the container. Never use trust in production.
set -e

cat > "$PGDATA/pg_hba.conf" << 'EOF'
# TYPE  DATABASE  USER  ADDRESS  METHOD
local   all       all            trust
host    all       all  all       trust
EOF

echo "pg_hba.conf rewritten — trust auth for local dev."
