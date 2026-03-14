BEGIN;
INSERT INTO users(id,google_id,email,first_name,last_name,access_token,refresh_token)
VALUES(1,'113738270040001178733','alexandr.kurilin@gmail.com','Alexandr','Kurilin', 'REDACTED_ACCESS_TOKEN_1','REDACTED_REFRESH_TOKEN_1');
COMMIT;

-- id                            | 2
-- google_id                     | 113738270040001178733
-- email                         | alexandr.kurilin@gmail.com
-- first_name                    | Alexandr
-- last_name                     | Kurilin
-- created_at                    | 2021-12-07 22:47:19.353497+00
-- updated_at                    | 2021-12-14 22:05:59.547633+00
-- access_token                  | REDACTED_ACCESS_TOKEN_1
-- refresh_token                 | REDACTED_REFRESH_TOKEN_1
-- push_notification_channel_id  | 2d4a19ff-b2db-4348-8ad6-5cbaade1f7aa
-- push_notification_resource_id | vRdgoLIT9oMb9str2ocLU-AFVZY
-- watching_until                | 2021-12-14 22:42:28.957+00
