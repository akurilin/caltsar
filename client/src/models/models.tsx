export interface APIEvent {
  googleId: string;
  recurringEventGoogleId: string;
  startDateTime: Date;
  endDateTime: Date;
  timeZone: string;
  summary: string;
  tracked: boolean;
}

export interface User {
  id: number;
  email: string;
}

// const tuple = <T extends string[]>(...args: T) => args;

// /**
//  * https://stackoverflow.com/a/59187769 Extract the type of an element of an array/tuple without
//  * performing indexing
//  */
// export type ElementOf<T> = T extends (infer E)[]
//   ? E
//   : T extends readonly (infer F)[]
//   ? F
//   : never;

// // this is utility stuff copied from ANTD since they don't expose this but still
// // expect you to use these exact types...
// // const tuple = <T extends string[]>(...args: T) => args;
// export const PresetStatusColorTypes = tuple(
//   "success",
//   "processing",
//   "error",
//   "default",
//   "warning"
// );

// export type PresetStatusColorType = ElementOf<typeof PresetStatusColorTypes>;
