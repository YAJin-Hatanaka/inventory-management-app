import "@testing-library/jest-dom";
import { TextDecoder, TextEncoder } from "util";

const globalScope = globalThis as Record<string, unknown>;

if (globalScope.TextEncoder === undefined) {
  globalScope.TextEncoder = TextEncoder;
}

if (globalScope.TextDecoder === undefined) {
  globalScope.TextDecoder = TextDecoder;
}

if (globalScope.Request === undefined) {
  globalScope.Request = class Request {
    readonly url: string;

    constructor(input: string | URL) {
      this.url = String(input);
    }
  };
}
