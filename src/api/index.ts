import { AutoRouter } from "itty-router";

import { RootStoreDurableObject } from "../do/rootstore";
import { DurableObjectStub, R2Bucket } from "@cloudflare/workers-types";

export { RootStoreDurableObject };

const ROOT_STORE_ID = "ROOT_STORE";

type Env = {
  ROOT_STORE: DurableObjectStub;
  R2_DATA: R2Bucket;
  ASSETS: {
    fetch: typeof fetch;
  };
};

const router = AutoRouter({ base: "/api" });

const mockBill = {
  items: [
    {
      name: "test",
      amount: 42,
    },
  ],
  total: 42,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rootStore = (env: any): RootStoreDurableObject => {
  const rootStoreId = env.ROOT_STORE.idFromName(ROOT_STORE_ID);
  return env.ROOT_STORE.get(rootStoreId);
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

  const id = crypto.randomUUID();

  await env.R2_DATA.put(`/bills/${id}`, await file.arrayBuffer(), {
    customMetadata: {
      mimeType: file.type,
    },
  });

  await rootStore(env).createBill(
    id,
    name.toString(),
    JSON.stringify(mockBill),
  );

  return Response.json({ id });
});

router.get("/v1/bill/:id", async (request, env: Env) => {
  const id = request.params.id;

  const bill = await rootStore(env).getBill(id);
  if (!bill) {
    return Response.json({ error: "Bill not found" }, { status: 404 });
  }

  // bill.image_url = env.R2_DATA.

  return Response.json(bill);
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

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env: Env) => env.ASSETS.fetch(request.url));

export default router;
