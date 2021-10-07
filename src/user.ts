import { Pool } from "pg";

export interface User {
  googleId: string;
  firstName: string;
  lastName: string;
  email: string;
}

export interface UserEntity extends User {
  id: number;
  createdAt: Date;
  updatedAt: Date;
}

export type CallbackFunction = (
  err: Error | null,
  user: UserEntity | null
) => void;

/* eslint-disable @typescript-eslint/no-explicit-any */
function convertDBRowToEntity(row: any): UserEntity {
  return {
    id: parseInt(row.id, 10),
    googleId: row.google_id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export function createUser(
  pool: Pool,
  params: User,
  callback: CallbackFunction
): void {
  pool.query(
    "INSERT INTO users (google_id, first_name, last_name, email) VALUES ($1, $2, $3, $4) RETURNING *",
    [params.googleId, params.firstName, params.lastName, params.email],
    (err, res) => {
      if (err) {
        callback(err, null);
      } else {
        return callback(null, convertDBRowToEntity(res.rows[0]));
      }
    }
  );
}

// TODO: should probably convert this from pool to a connection instead....
export function findOrCreate(
  pool: Pool,
  params: User,
  callback: CallbackFunction
): void {
  console.log("User.findOrCreate");
  pool.query(
    "SELECT * FROM users WHERE google_id = $1",
    [params.googleId],
    (err, res) => {
      if (err) {
        console.log("User.findOrCreate - error");
        callback(err, null);
      } else if (res.rows.length === 1) {
        console.log("User.findOrCreate - user found");
        callback(null, convertDBRowToEntity(res.rows[0]));
      } else {
        console.log("User.findOrCreate - creating user");
        createUser(pool, params, callback);
      }
    }
  );
}

export function findById(
  pool: Pool,
  id: number,
  callback: CallbackFunction
): void {
  console.log("User.findById");
  pool.query("SELECT * FROM users WHERE id = $1", [id], (err, res) => {
    if (err) {
      console.log("User.findById - error");
      callback(err, null);
    } else if (res.rows.length === 1) {
      console.log(res.rows[0]);
      callback(null, convertDBRowToEntity(res.rows[0]));
    } else {
      console.log("User.findById - no user found");
      callback(null, null);
    }
  });
}

export default { findOrCreate, findById };
