# if [ -z ${CHANGELOG_FILE} ]; then
#   echo "CHANGELOG_FILE not set"
#   exit 1
# fi

ROOT_FOLDER=/Users/alex/code/caltsar
CHANGELOG_FOLDER=/sql/changelog
CHANGELOG_FILE=changelog.postgresql.sql

docker run --network=host --rm -v "$ROOT_FOLDER""$CHANGELOG_FOLDER":/liquibase/changelog \
  liquibase/liquibase \
  --url=jdbc:postgresql://localhost:5432/caltsar_dev \
  --username=postgres \
  --password=password \
  generateChangeLog \
  --changeLogFile=/liquibase/changelog/"$CHANGELOG_FILE" && \
npx sql-formatter -l postgresql -u < ."$CHANGELOG_FOLDER"/"$CHANGELOG_FILE" -o \
  ."$CHANGELOG_FOLDER"/"$CHANGELOG_FILE" && \
cat ."$CHANGELOG_FOLDER"/"$CHANGELOG_FILE"
