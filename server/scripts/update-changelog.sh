if [ -z "${PGDATABASE}" ]; then
  PGDATABASE=caltsar_dev
fi

if [ -z "${PGHOST}" ]; then
  PGHOST=localhost
fi
if [ -z "${PGPORT}" ]; then
  PGPORT=5432
fi
if [ -z "${PGUSER}" ]; then
  PGUSER=postgres
fi
if [ -z "${PGPASSWORD}" ]; then
  PGPASSWORD=password
fi

ROOT_FOLDER=/Users/alex/code/caltsar
CHANGELOG_FOLDER=/sql/changelog
CHANGELOG_FILE=changelog.postgresql.sql

# if [ -z "${DATABASE_URL}" ]; then
# shellcheck disable=SC2125
URL=jdbc:postgresql://"${PGHOST}":"${PGPORT}"/"$PGDATABASE"?user="${PGUSER}"\&password="${PGPASSWORD}"
# else
#   URL=jdbc:"${DATABASE_URL}"
# fi

echo "$URL"

docker run --network=host --rm -v "$ROOT_FOLDER""$CHANGELOG_FOLDER":/liquibase/changelog \
  liquibase/liquibase --url="${URL}" --changeLogFile="${CHANGELOG_FILE}" update

# backup
# docker run --network=host --rm -v "$ROOT_FOLDER""$CHANGELOG_FOLDER":/liquibase/changelog \
#   liquibase/liquibase \
#   --url=jdbc:postgresql://${PGHOST}:${PGPORT}/"$PGDATABASE" \
#   --username=${PGUSER} \
#   --password=${PGPASSWORD} \
#   --changeLogFile="$CHANGELOG_FILE" \
#   update
