import { AutoRouter } from "itty-router";

import { BillWsDurableObject } from "../do/billws";
import { RootStoreDurableObject } from "../do/rootstore";

import { DurableObjectNamespace, R2Bucket } from "@cloudflare/workers-types";

import { OpenAIBillScanner } from "../scanner/openai";
import OpenAI from "openai";

export { BillWsDurableObject, RootStoreDurableObject };

const ROOT_STORE_ID = "ROOT_STORE";

type Env = {
  ROOT_STORE: DurableObjectNamespace;
  PER_BILL_WS: DurableObjectNamespace;
  R2_DATA: R2Bucket;
  ASSETS: {
    fetch: typeof fetch;
  };
  OPENAI_API_KEY: string;
};

const router = AutoRouter({ base: "/api" });

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rootStore = (env: any): RootStoreDurableObject => {
  const rootStoreId = env.ROOT_STORE.idFromName(ROOT_STORE_ID);
  return env.ROOT_STORE.get(rootStoreId);
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const perBillWs = (env: any, id: string): BillWsDurableObject => {
  const perBillWsId = env.PER_BILL_WS.idFromName(id);
  return env.PER_BILL_WS.get(perBillWsId);
};

router.post("/v1/scan", async (request, env: Env) => {
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

  console.log(result);

  const id = crypto.randomUUID();

  await env.R2_DATA.put(`/bills/${id}`, await file.arrayBuffer(), {
    customMetadata: {
      mimeType: file.type,
    },
  });

  await rootStore(env).createBill(id, name.toString(), JSON.stringify(result));

  return Response.json({ id });
});

router.get("/v1/bill/:id", async (request, env: Env) => {
  const id = request.params.id;

  const bill = await rootStore(env).getBill(id);
  if (!bill) {
    return Response.json({ error: "Bill not found" }, { status: 404 });
  }

  return Response.json(bill);
});

router.post("/v1/bill/:id/claim/:item", async (request, env: Env) => {
  const id = request.params.id;
  const item = request.params.item;
  const body = await request.json();

  const userPrivateId = body.userPrivateId;
  const numericShares = parseInt(body.shares, 10);
  if (isNaN(numericShares) || numericShares < 0 || numericShares > 42) {
    return Response.json(
      { error: "Invalid shares. Must be between 0 and 42" },
      { status: 400 },
    );
  }

  await rootStore(env).claimItem(userPrivateId, id, item, numericShares);
  await perBillWs(env, id).broadcast(`${id}:${item}:${numericShares}`);

  return Response.json({ id });
});

router.get("/v1/bill/:id/image", async (request, env: Env) => {
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

router.get("/v1/bill/:id/ws", async (request, env: Env) => {
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

router.post("/v1/user", async (request, env: Env) => {
  const body = await request.json();
  const id = body.id;
  const privateId = body.privateId;
  const name = body.name;

  if (!id || !privateId || !name) {
    return Response.json({ error: "Missing required fields" }, { status: 400 });
  }

  await rootStore(env).upsertUser(privateId, id, name);
  return Response.json({ id });
});

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env: Env) => env.ASSETS.fetch(request.url));

export default router;
