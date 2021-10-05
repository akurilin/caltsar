/* DROP TABLE IF EXISTS activities; */
DROP TABLE IF EXISTS users;

CREATE TABLE users (
  id serial PRIMARY KEY,
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT NOW(),
  updated_at timestamptz NOT NULL DEFAULT NOW()
);

/* CREATE TABLE activities ( */
/*   id serial PRIMARY KEY, */
/*   user_id integer REFERENCES users(id), */
/*   type text NOT NULL, */
/*   day date NOT NULL, */
/*   description text, */
/*   attachment text, */
/*   created_at timestamptz NOT NULL DEFAULT NOW(), */
/*   updated_at timestamptz NOT NULL DEFAULT NOW() */
/* ); */

INSERT INTO users (name) VALUES ('alex');

-- assuming alex is id 1
/* INSERT INTO activities (user_id, type, day, description) VALUES (1, 'music', '8/20/2021', 'Did a piano tune today'); */

SELECT * FROM users;
/* SELECT * FROM activities; */
