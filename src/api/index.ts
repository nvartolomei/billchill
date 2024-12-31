import { AutoRouter } from "itty-router";

import { RootStoreDurableObject } from "../do/rootstore";

export { RootStoreDurableObject };

const ROOT_STORE_ID = "ROOT_STORE";

const router = AutoRouter({ base: "/api" });

const mockBill = {
  id: "123",
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

router.post("/v1/scan", async (request, env) => {
  const formData = await request.formData();
  const name = formData.get("name");
  const file = formData.get("file");

  if (!name) {
    return Response.json({ error: "No name provided" }, { status: 400 });
  }

  if (!file) {
    return Response.json({ error: "No file provided" }, { status: 400 });
  }

  const id = crypto.randomUUID();

  await rootStore(env).createBill(
    id,
    name.toString(),
    JSON.stringify(mockBill),
  );

  return Response.json({ id });
});

router.get("/v1/bill/:id", async (request, env) => {
  const id = request.params.id;

  const bill = await rootStore(env).getBill(id);

  return Response.json(bill);
});

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env) => env.ASSETS.fetch(request.url));

export default router;
