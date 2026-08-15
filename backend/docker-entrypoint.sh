#!/bin/sh
set -e

echo "Running database migrations..."
node dist/db/migrate.js

echo "Starting Campus Pulse API..."
exec "$@"
