import { AutoRouter } from "itty-router";
import OpenAI from "openai";
import { z } from "zod";

import { BillWsDurableObject } from "../do/billws";
import { RootStoreDurableObject } from "../do/rootstore";
import { OpenAIBillScanner } from "../scanner/openai";

export { BillWsDurableObject, RootStoreDurableObject };

const ROOT_STORE_ID = "ROOT_STORE";

type Env = {
  ROOT_STORE: DurableObjectNamespace<RootStoreDurableObject>;
  PER_BILL_WS: DurableObjectNamespace<BillWsDurableObject>;
  R2_DATA: R2Bucket;
  ASSETS: {
    fetch: typeof fetch;
  };
  OPENAI_API_KEY: string;
};

const router = AutoRouter();

const rootStore = (env: Env): DurableObjectStub<RootStoreDurableObject> => {
  const rootStoreId = env.ROOT_STORE.idFromName(ROOT_STORE_ID);
  return env.ROOT_STORE.get(rootStoreId);
};

const perBillWs = (
  env: Env,
  id: string,
): DurableObjectStub<BillWsDurableObject> => {
  const perBillWsId = env.PER_BILL_WS.idFromName(id);
  return env.PER_BILL_WS.get(perBillWsId);
};

router.post("/api/v1/scan", async (request, env: Env) => {
  const formData = await request.formData();
  const name = formData.get("name");
  const file = formData.get("file") as null | File;

  if (!name) {
    return Response.json({ error: "No name provided" }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const arrayBuffer = await file.arrayBuffer();
  const b64Image = btoa(
    new Uint8Array(arrayBuffer).reduce(function (data, byte) {
      return data + String.fromCharCode(byte);
    }, ""),
  );

  const openai = new OpenAI({
    apiKey: env.OPENAI_API_KEY,
  });

  const scanner = new OpenAIBillScanner(openai, "gpt-4o");
  const result = await scanner.scan(b64Image);

  if (!result) {
    return Response.json({ error: "Failed to scan bill" }, { status: 500 });
  }

  const id = crypto.randomUUID();

  await env.R2_DATA.put(`/bills/${id}`, await file.arrayBuffer(), {
    customMetadata: {
      mimeType: file.type,
    },
  });

  await rootStore(env).createBill(id, name.toString(), JSON.stringify(result));

  return Response.json({ id });
});

router.get("/api/v1/bill/:id", async (request, env: Env) => {
  const id = request.params.id;

  const bill = await rootStore(env).getBill(id);
  if (!bill) {
    return Response.json({ error: "Bill not found" }, { status: 404 });
  }

  return Response.json(bill);
});

router.post("/api/v1/bill/:id/claim/:item", async (request, env: Env) => {
  const id = request.params.id;
  const item = request.params.item;

  const bodySchema = z.object({
    userPrivateId: z.string().uuid(),
    shares: z.number().int().min(0).max(42),
  });

  const body = bodySchema.parse(await request.json());

  await rootStore(env).claimItem(body.userPrivateId, id, item, body.shares);
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

const createUserRequestSchema = z.object({
  id: z.string().uuid(),
  privateId: z.string().uuid(),
  name: z.string().min(1),
});

type CreateUserResponse = z.infer<typeof createUserRequestSchema>;

router.post(
  "/api/v1/user",
  async (request, env: Env): Promise<CreateUserResponse> => {
    const body = createUserRequestSchema.parse(await request.json());

    await rootStore(env).upsertUser(body.privateId, body.id, body.name);

    return body;
  },
);

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env: Env) => env.ASSETS.fetch(request.url));

export default router;
