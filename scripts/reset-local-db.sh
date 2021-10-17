# delete and restart postgres container
docker stop postgres13
docker rm postgres13

# start postgres container with data stored on local drive and with the sql
# script mirrored to the /alex folder
docker run -d --name=postgres13 -p 5432:5432 -v postgres-volume:/var/lib/postgresql/data -v "$(pwd)/sql":/alex -e POSTGRES_PASSWORD=password postgres:13.4

# run the SQL script using psql already in the container
docker exec -it postgres13 psql -U postgres -c "DROP DATABASE IF EXISTS caltsar_dev"
docker exec -it postgres13 psql -U postgres -c "DROP DATABASE IF EXISTS caltsar_test"
docker exec -it postgres13 psql -U postgres -c "CREATE DATABASE caltsar_dev"
docker exec -it postgres13 psql -U postgres -c "CREATE DATABASE caltsar_test"

PGDATABASE=caltsar_dev ./scripts/update-changelog.sh
PGDATABASE=caltsar_test ./scripts/update-changelog.sh
