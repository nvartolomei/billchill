import type { IttyRouterType } from "itty-router";
import { z } from "zod";

import { RootStoreDurableObject } from "../do/rootstore";
import { Env } from "./types";

const authorizationHeaderValueSchema = z
  .string()
  .regex(/^Bearer [a-zA-Z0-9\-]{36}$/);

export function privateIdFromRequest(request: Request): string {
  const authorizationHeaderValue = authorizationHeaderValueSchema.parse(
    request.headers.get("Authorization"),
  );
  const token = authorizationHeaderValue.split(" ")[1];
  return token;
}

export const installAuthRoutes = (
  router: IttyRouterType,
  rootStore: (env: Env) => DurableObjectStub<RootStoreDurableObject>,
) => {
  const createUserRequestSchema = z.object({
    name: z.string().min(1),
  });

  type CreateUserResponse = {
    id: string;
    privateId: string;
    name: string;
  };

  router.post(
    "/api/v1/user",
    async (request, env: Env): Promise<CreateUserResponse> => {
      let user: CreateUserResponse | null = null;
      try {
        const existingPrivateId = privateIdFromRequest(request);
        user = await rootStore(env).getUserPrivate(existingPrivateId);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {}

      const body = createUserRequestSchema.parse(await request.json());

      const privateId = user?.privateId || crypto.randomUUID();
      const id = user?.id || crypto.randomUUID();

      await rootStore(env).upsertUser(privateId, id, body.name);

      return { id, privateId, name: body.name };
    },
  );

  router.get("/api/v1/id", async (request, env: Env): Promise<Response> => {
    const privateId = privateIdFromRequest(request);

    const user: CreateUserResponse | null =
      await rootStore(env).getUserPrivate(privateId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 404 });
    }

    return Response.json(user);
  });
};
