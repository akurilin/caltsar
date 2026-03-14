BEGIN;
INSERT INTO users(id,google_id,email,first_name,last_name,access_token,refresh_token)
VALUES(1,'000000000000000000000','testuser@example.com','Test','User', 'PLACEHOLDER_ACCESS_TOKEN','PLACEHOLDER_REFRESH_TOKEN');
COMMIT;
