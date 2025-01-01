import { DurableObjectState } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

interface Env {
  ROOT_STORE: DurableObject;
}

export class BillWsDurableObject extends DurableObject {
  ctx: DurableObjectState;
  listeners: WebSocket[];
  constructor(state: DurableObjectState, env: Env) {
    super(state, env);
    this.ctx = state;
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async broadcast(message: string) {
    const listeners = await this.ctx.getWebSockets();
    console.log("Broadcasting", message, listeners.length);

    for (const listener of listeners) {
      try {
        listener.send(message);
      } catch (e) {
        console.error("Error sending message", e);
      }
    }
  }
}
