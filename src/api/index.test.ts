import {
  createExecutionContext,
  env,
  waitOnExecutionContext,
} from "cloudflare:test";
import { describe, expect, it } from "vitest";

import worker from "./index";

describe("BillChill worker", () => {
  it("index page", async () => {
    const request = new Request("http://example.com");
    // Create an empty context to pass to `worker.fetch()`
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    // Wait for all `Promise`s passed to `ctx.waitUntil()` to settle before running test assertions
    await waitOnExecutionContext(ctx);

    expect(await response.text()).toContain("BillChill");
  });

  it("not found routes to index page", async () => {
    const request = new Request("http://example.com/foo");
    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    expect(await response.text()).toContain("BillChill");
  });

  it("create user and get it", async () => {
    const createUserRequest = {
      name: "John Doe",
    };

    const request = new Request("http://example.com/api/v1/user", {
      method: "POST",
      body: JSON.stringify(createUserRequest),
    });

    const ctx = createExecutionContext();
    const response = await worker.fetch(request, env, ctx);

    const createUserResponse = await response.json();

    expect(createUserResponse.id).toBeDefined();
    expect(createUserResponse.privateId).toBeDefined();
    expect(createUserResponse.name).toEqual(createUserRequest.name);

    const idResponse = await worker.fetch(
      new Request(`http://example.com/api/v1/id`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${createUserResponse.privateId}`,
        },
      }),
      env,
      ctx,
    );

    expect(await idResponse.json()).toEqual(createUserResponse);
  });
});
