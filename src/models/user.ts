import { Pool, PoolClient } from "pg";

export interface User {
  googleId: string;
  firstName: string;
  lastName: string;
  email: string;
  accessToken: string;
  refreshToken: string;
}

export interface UserEntity extends User {
  id: number;
  pushNotificationChannelId: string | null;
  pushNotificationResourceId: string | null;
  watchingUntil: Date | null;
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
    accessToken: row.access_token,
    refreshToken: row.refresh_token,
    pushNotificationChannelId: row.push_notification_channel_id
      ? row.push_notification_channel_id
      : null,
    pushNotificationResourceId: row.push_notification_resource_id
      ? row.push_notification_resource_id
      : null,
    watchingUntil: row.watching_until ? new Date(row.watching_until) : null,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

export async function createUser(
  poolClient: PoolClient,
  params: User
): Promise<UserEntity> {
  const res = await poolClient.query(
    `INSERT INTO users (google_id, first_name, last_name, email, access_token, refresh_token)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      params.googleId,
      params.firstName,
      params.lastName,
      params.email,
      params.accessToken,
      params.refreshToken,
    ]
  );
  return convertDBRowToEntity(res.rows[0]);
}

export async function updateTokens(
  pool: Pool,
  id: number,
  accessToken: string,
  refreshToken: string
): Promise<void> {
  try {
    await pool.query(
      "UPDATE users SET access_token = $1, refresh_token = $2 WHERE id = $3",
      [accessToken, refreshToken, id]
    );
  } catch (err) {
    console.error(`Could not update user with id ${id}`);
    throw new Error("Could not update user's Google API tokens");
  }
}

export async function updateAccessToken(
  pool: Pool,
  id: number,
  accessToken: string
): Promise<void> {
  try {
    await pool.query("UPDATE users SET access_token = $1 WHERE id = $2", [
      accessToken,
      id,
    ]);
  } catch (err) {
    console.error(`Could not update user with id ${id}`);
  }
}

export function findOrCreate(
  pool: Pool,
  params: User,
  callback: CallbackFunction
): void {
  console.log("User.findOrCreate");

  // these's a chance that this conflicts on email, as opposed to the google_id,
  // and I'm not sure what exactly to do in that case given that both columns
  // are unique. One would hope that PG is clever enough to not arbitrary cycle
  // through conflict targets and pick one, but instead instead prioritizes the
  // one chosen in the ON CONFLICT clause
  pool.query(
    `INSERT INTO users (google_id, first_name, last_name, email, access_token, refresh_token)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (google_id) DO UPDATE SET access_token = EXCLUDED.access_token, refresh_token = EXCLUDED.refresh_token, updated_at = NOW()
             RETURNING *`,
    [
      params.googleId,
      params.firstName,
      params.lastName,
      params.email,
      params.accessToken,
      params.refreshToken,
    ],
    (err, res) => {
      if (err) {
        console.error(err);
        callback(new Error("Could not create or update user"), null);
      } else {
        callback(null, convertDBRowToEntity(res.rows[0]));
      }
    }
  );
}

export function findById(
  pool: Pool,
  id: number,
  callback: CallbackFunction
): void {
  // console.log("User.findById");
  pool.query("SELECT * FROM users WHERE id = $1", [id], (err, res) => {
    if (err) {
      console.log("User.findById - error");
      callback(err, null);
    } else if (res.rows.length === 1) {
      // console.log(res.rows[0]);
      callback(null, convertDBRowToEntity(res.rows[0]));
    } else {
      console.log("User.findById - no user found");
      callback(null, null);
    }
  });
}

export async function findByIdAsync(
  pool: Pool,
  id: number
): Promise<UserEntity | null> {
  const res = await pool.query("SELECT * FROM users WHERE id = $1", [id]);
  if (res.rows[0]) {
    return convertDBRowToEntity(res.rows[0]);
  } else {
    return null;
  }
}

export async function fetchByPushNotification(
  poolClient: PoolClient,
  channelId: string,
  resourceId: string
): Promise<UserEntity | null> {
  const userQuery = await poolClient.query(
    `SELECT *
     FROM users
     WHERE push_notification_channel_id = $1 AND push_notification_resource_id = $2`,
    [channelId, resourceId]
  );
  if (userQuery.rows.length == 1) {
    return convertDBRowToEntity(userQuery.rows[0]);
  } else if (userQuery.rows.length > 1) {
    throw new Error(
      `Found more than one user with channel ${channelId} and resource ${resourceId}`
    );
  } else {
    return null;
  }
}

export async function deleteByGoogleId(
  poolClient: PoolClient,
  googleId: string
): Promise<void> {
  await poolClient.query(
    `DELETE
     FROM users
     WHERE google_id = $1`,
    [googleId]
  );
}
