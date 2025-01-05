import { BillWsDurableObject } from "../do/billws";
import { RootStoreDurableObject } from "../do/rootstore";

export type Env = {
  ROOT_STORE: DurableObjectNamespace<RootStoreDurableObject>;
  PER_BILL_WS: DurableObjectNamespace<BillWsDurableObject>;
  R2_DATA: R2Bucket;
  ASSETS: {
    fetch: typeof fetch;
  };
  OPENAI_API_KEY: string;
};
