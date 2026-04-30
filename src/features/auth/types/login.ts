import type { LoginFieldErrors } from "../schemas/login-schema";

export type LoginResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly fieldErrors?: LoginFieldErrors;
    };
