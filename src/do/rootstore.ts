import { DurableObjectState, SqlStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

interface Env {
  ROOT_STORE: DurableObject;
}

type Bill = Record<string, string>;

export class RootStoreDurableObject extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, date TEXT, name TEXT, scan TEXT)`,
    );
  }

  async getBill(id: string): Promise<Bill | null> {
    const results = await this.sql.exec<Bill>(
      "SELECT id, date, name, scan FROM bills WHERE id = ?",
      id,
    );

    if (results.rowsRead === 0) {
      return null;
    }

    return results.one();
  }

  async createBill(id: string, name: string, scan: string): Promise<void> {
    this.sql.exec(
      "INSERT INTO bills (id, date, name, scan) VALUES (?, datetime('now'), ?, ?)",
      id,
      name,
      scan,
    );
  }
}
