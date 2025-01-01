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
    this.listeners = [];
  }

  async fetch(request: Request) {
    const webSocketPair = new WebSocketPair();
    const [client, server] = Object.values(webSocketPair);

    this.ctx.acceptWebSocket(server);
    this.listeners.push(server);

    return new Response(null, {
      status: 101,
      webSocket: client,
    });
  }

  async broadcast(message: string) {
    let deadListeners: WebSocket[] = [];

    this.listeners.forEach((listener) => {
      if (listener.readyState === WebSocket.OPEN) {
        listener.send(message);
      } else {
        deadListeners.push(listener);
      }
    });

    this.listeners = this.listeners.filter((l) => !deadListeners.includes(l));
  }
}
