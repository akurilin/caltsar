ROOT_FOLDER=/Users/alex/code/caltsar
CHANGELOG_FOLDER=/sql/changelog
CHANGELOG_FILE=changelog.postgresql.sql
docker run --network=host --rm -v "$ROOT_FOLDER""$CHANGELOG_FOLDER":/liquibase/changelog \
  liquibase/liquibase \
  --url=jdbc:postgresql://localhost:5432/"$PGDATABASE" \
  --username=postgres \
  --password=password \
  --changeLogFile="$CHANGELOG_FILE" \
  update
