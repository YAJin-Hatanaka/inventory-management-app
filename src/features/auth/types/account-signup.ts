import type {
  AccountSignupFieldErrors,
} from "../schemas/account-signup-schema";

export type CreateAccountResult =
  | {
      readonly success: true;
    }
  | {
      readonly success: false;
      readonly message: string;
      readonly fieldErrors?: AccountSignupFieldErrors;
    };
