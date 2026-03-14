if [ -z "${PGDATABASE}" ]; then
    echo "Error: PGDATABASE not set"
      exit 1
fi

docker exec -it postgres13 psql -U postgres -d "${PGDATABASE}" -f /alex/seed.sql
