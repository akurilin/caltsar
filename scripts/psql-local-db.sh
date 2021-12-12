if [ -z "${PGDATABASE}" ]; then
  PGDATABASE=caltsar_dev
fi

docker exec -it postgres13 psql -U postgres -d ${PGDATABASE}
