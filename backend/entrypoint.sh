#!/bin/sh
set -e

# Wait for PostgreSQL
if [ -n "$DB_HOST" ] && [ -n "$DB_PORT" ]; then
  echo "Waiting for PostgreSQL at $DB_HOST:$DB_PORT..."
  for i in $(seq 1 60); do
    nc -z "$DB_HOST" "$DB_PORT" && echo "PostgreSQL is up" && break
    echo "PostgreSQL not ready yet ($i/60). Sleeping 2s..." && sleep 2
  done
fi

python manage.py collectstatic --noinput
python manage.py migrate --noinput

exec gunicorn ielts_platform.wsgi:application \
  --bind 0.0.0.0:8000 \
  --workers 3 \
  --timeout 120


