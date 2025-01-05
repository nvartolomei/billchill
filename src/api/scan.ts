import type { IttyRouterType } from "itty-router";
import OpenAI from "openai";

import { RootStoreDurableObject } from "../do/rootstore";
import { OpenAIBillScanner } from "../scanner/openai";
import { privateIdFromRequest } from "./auth";
import { Env } from "./types";

export const installScanRoutes = (
  router: IttyRouterType,
  rootStore: (env: Env) => DurableObjectStub<RootStoreDurableObject>,
) => {
  router.post("/api/v1/scan", async (request, env: Env) => {
    const privateId = privateIdFromRequest(request);
    const user = await rootStore(env).getUserPrivate(privateId);
    if (!user) {
      return Response.json({ error: "User not found" }, { status: 401 });
    }

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

    await rootStore(env).createBill(
      user.id,
      id,
      name.toString(),
      JSON.stringify(result),
    );

    return Response.json({ id });
  });
};
