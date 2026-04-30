import { describe, expect, it } from "@jest/globals";
import {
  checkAccountSignupRateLimitForKey,
  toAccountSignupClientKey,
  type RateLimitEntry,
} from "./account-signup-rate-limit";

describe("toAccountSignupClientKey", () => {
  it("x-forwarded-for の先頭 IP を使用する", () => {
    const headers = new Headers({
      "x-forwarded-for": "192.0.2.1, 198.51.100.1",
      "x-real-ip": "203.0.113.1",
    });

    expect(toAccountSignupClientKey(headers)).toBe("192.0.2.1");
  });

  it("x-forwarded-for が空なら x-real-ip を使用する", () => {
    const headers = new Headers({
      "x-forwarded-for": " ",
      "x-real-ip": "203.0.113.1",
    });

    expect(toAccountSignupClientKey(headers)).toBe("203.0.113.1");
  });

  it("IP ヘッダーが取得できない場合は unknown を使用する", () => {
    expect(toAccountSignupClientKey(new Headers())).toBe("unknown");
  });
});

describe("checkAccountSignupRateLimitForKey", () => {
  it("上限までは許可し、上限到達後は拒否する", () => {
    const store = new Map<string, RateLimitEntry>();
    const options = {
      clientKey: "192.0.2.1",
      maxAttempts: 2,
      now: 1000,
      store,
      windowMs: 10000,
    };

    expect(checkAccountSignupRateLimitForKey(options)).toBe(true);
    expect(checkAccountSignupRateLimitForKey(options)).toBe(true);
    expect(checkAccountSignupRateLimitForKey(options)).toBe(false);
  });

  it("期限切れ後はカウントをリセットする", () => {
    const store = new Map<string, RateLimitEntry>([
      [
        "192.0.2.1",
        {
          attempts: 2,
          resetAt: 2000,
        },
      ],
    ]);

    expect(
      checkAccountSignupRateLimitForKey({
        clientKey: "192.0.2.1",
        maxAttempts: 2,
        now: 2000,
        store,
        windowMs: 10000,
      }),
    ).toBe(true);
    expect(store.get("192.0.2.1")).toEqual({
      attempts: 1,
      resetAt: 12000,
    });
  });
});
