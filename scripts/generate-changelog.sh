# CHANGELOG_FOLDER=/Users/alex/code/caltsar/sql/changelog
docker run --network=host --rm -v /Users/alex/code/caltsar/sql/changelog:/liquibase/changelog \
  liquibase/liquibase \
  --url=jdbc:postgresql://localhost:5432/caltsar_dev \
  --username=postgres \
  --password=password \
  generateChangeLog \
  --changeLogFile=/liquibase/changelog/changelog.sql \
  --overwrite-output-file=true && \
npx sql-formatter -l postgresql -u < ./sql/changelog/changelog.sql -o \
  ./sql/changelog/changelog.sql && \
cat ./sql/changelog/changelog.sql
