import { describe, expect, it, test } from "vitest";
import { privateIdFromRequest } from "./auth";

describe("privateIdFromRequest", () => {
  it("should fail if the authorization header is not present", () => {
    const request = new Request("http://example.com");
    expect(() => privateIdFromRequest(request)).toThrow();
  });

  test.for(["", "Bearer", "Bearer   ", "Bearer 1234567890"])(
    "should fail if the authorization header does not have correct format (%s)",
    (value) => {
      const request = new Request("http://example.com", {
        headers: { Authorization: value },
      });
      expect(() => privateIdFromRequest(request)).toThrow();
    },
  );

  it("should return the private id if the authorization header has correct format", () => {
    const request = new Request("http://example.com", {
      headers: { Authorization: "Bearer 3101c1fc-7d09-48ee-8f1c-fe421ce8b18a" },
    });
    expect(privateIdFromRequest(request)).toBe(
      "3101c1fc-7d09-48ee-8f1c-fe421ce8b18a",
    );
  });
});
