import { AutoRouter } from "itty-router";

import { BillWsDurableObject } from "../do/billws";
import { RootStoreDurableObject } from "../do/rootstore";
import { installAuthRoutes } from "./auth";
import { installBillRoutes } from "./bill";
import { installScanRoutes } from "./scan";
import { Env } from "./types";

export { BillWsDurableObject, RootStoreDurableObject };

const ROOT_STORE_ID = "ROOT_STORE";

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

installAuthRoutes(router, rootStore);
installBillRoutes(router, rootStore, perBillWs);
installScanRoutes(router, rootStore);

// Fallback to static assets
// See: https://developers.cloudflare.com/workers/static-assets/
router.all("*", async (request, env: Env) => env.ASSETS.fetch(request.url));

export default router;
