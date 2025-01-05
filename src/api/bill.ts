import type { IttyRouterType } from "itty-router";
import { z } from "zod";

import { BillWsDurableObject } from "../do/billws";
import { RootStoreDurableObject } from "../do/rootstore";
import type { Env } from "./types";
import { privateIdFromRequest } from "./auth";

export const installBillRoutes = (
  router: IttyRouterType,
  rootStore: (env: Env) => DurableObjectStub<RootStoreDurableObject>,
  perBillWs: (env: Env, id: string) => DurableObjectStub<BillWsDurableObject>,
) => {
  router.get("/api/v1/bill/:id", async (request, env: Env) => {
    const id = request.params.id;

    const bill = await rootStore(env).getBill(id);
    if (!bill) {
      return Response.json({ error: "Bill not found" }, { status: 404 });
    }

    return Response.json(bill);
  });

  router.post("/api/v1/bill/:id/claim/:item", async (request, env: Env) => {
    const privateId = privateIdFromRequest(request);
    const user = await rootStore(env).getUserPrivate(privateId);
    if (!user) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const id = request.params.id;
    const item = request.params.item;

    const bodySchema = z.object({
      shares: z.number().int().min(0).max(42),
    });

    const body = bodySchema.parse(await request.json());

    await rootStore(env).claimItem(user.privateId, id, item, body.shares);
    await perBillWs(env, id).broadcast(`${id}:${item}:${body.shares}`);

    return Response.json({ id });
  });

  router.get("/api/v1/bill/:id/image", async (request, env: Env) => {
    const object = await env.R2_DATA.get(`/bills/${request.params.id}`);

    if (object === null) {
      return new Response("Object Not Found", { status: 404 });
    }

    const headers = new Headers();
    object.writeHttpMetadata(headers);
    headers.set("etag", object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  });

  router.get("/api/v1/bill/:id/ws", async (request, env: Env) => {
    const upgradeHeader = request.headers.get("Upgrade");
    if (!upgradeHeader || upgradeHeader !== "websocket") {
      return new Response("Expected Upgrade: websocket", { status: 426 });
    }

    const id = request.params.id;

    const wsStub = perBillWs(env, id);

    return wsStub.fetch(request.url, {
      headers: request.headers,
    });
  });
};
