export interface User {
  id: number;
}

export interface Params {
  googleId: string;
}

export type CallbackFunction = (err: Error | null, user: User) => void;

// TODO: this needs to actually call into the database and do all of that usual
// good stuff
export function findOrCreate(params: Params, callback: CallbackFunction): void {
  // console.log(params);
  // console.log(callback);
  console.log("Complete me!");
  // pool.query("SELECT * FROM users WHERE google_id = ", (err, res) => {
  //   console.log(err, res);
  //   pool.end();
  // });
  callback(null, { id: 1 });
}

export function findById(id: number, callback: CallbackFunction): void {
  callback(null, { id: 1 });
}

export default { findOrCreate, findById };
