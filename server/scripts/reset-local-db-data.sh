# this should wipe all the relevant tables if you point it high enough in the
# reference chain
docker exec -it postgres13 psql -U postgres -d caltsar_dev -c "TRUNCATE recurring_events RESTART IDENTITY CASCADE"
docker exec -it postgres13 psql -U postgres -d caltsar_test -c "TRUNCATE recurring_events RESTART IDENTITY CASCADE"
