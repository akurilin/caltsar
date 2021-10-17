ROOT_FOLDER=/Users/alex/code/caltsar
CHANGELOG_FOLDER=/sql/changelog
docker run --network=host --rm -v "$ROOT_FOLDER""$CHANGELOG_FOLDER":/liquibase/changelog \
  liquibase/liquibase \
  --url=jdbc:postgresql://localhost:5432/"$PGDATABASE" \
  --username=postgres \
  --password=password \
  --changeLogFile=changelog.sql \
  update
