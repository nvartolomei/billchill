import { DurableObjectState, SqlStorage } from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

import { type Bill } from "./types";

interface Env {
  ROOT_STORE: DurableObject;
}

export class RootStoreDurableObject extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, date TEXT, name TEXT, scan TEXT)`,
    );
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, privateId TEXT, name TEXT)`,
    );
    this.sql.exec(
      `CREATE UNIQUE INDEX IF NOT EXISTS users_privateId_idx ON users (privateId)`,
    );
  }

  getRawBill(id: string) {
    const results = this.sql.exec(
      "SELECT id, date, name, scan FROM bills WHERE id = ?",
      id,
    );

    if (results.rowsRead === 0) {
      return null;
    }

    return results.one();
  }

  getBill(id: string): Bill | null {
    const bill = this.getRawBill(id);
    if (!bill) {
      return null;
    }

    const scanJson = JSON.parse(bill.scan as string);
    const manualTotal = scanJson.items.reduce(
      (acc, item) => acc + item.amount,
      0,
    );

    if (scanJson.total !== manualTotal) {
      scanJson.items.push({
        name: "Unaccounted (e.g. tip, tax, etc.)",
        autoClaiming: true,
        amount: (scanJson.total - manualTotal).toFixed(2),
      });
    }

    const participants = new Set<string>();
    for (const item of scanJson.items) {
      if (item.claimers) {
        for (const claimer of item.claimers) {
          participants.add(claimer.id);
        }
      } else {
        item.claimers = [];
      }
    }

    for (const item of scanJson.items) {
      if (item.autoClaiming) {
        for (const participant of participants) {
          item.claimers = [
            ...(item.claimers || []),
            { id: participant, shares: 1 },
          ];
        }
      }
    }

    const billParticipants: Record<string, { id: string; name: string }> = {};
    for (const participant of participants) {
      const user = this.getUser(participant);
      if (!user || !user.name) {
        throw new Error(`User ${participant} not found or has no name`);
      }
      billParticipants[participant] = {
        id: participant,
        name: user.name as string,
      };
    }

    return {
      name: bill.name as string,
      date: bill.date as string,
      scan: scanJson,
      participants: billParticipants,
    };
  }

  createBill(id: string, name: string, scan: string) {
    this.sql.exec(
      "INSERT INTO bills (id, date, name, scan) VALUES (?, datetime('now'), ?, ?)",
      id,
      name,
      scan,
    );
  }

  claimItem(userPrivateId: string, id: string, itemId: string, shares: number) {
    const user = this.getUserPrivate(userPrivateId);
    if (!user) {
      throw new Error("User not found");
    }

    const bill = this.getRawBill(id);

    if (!bill) {
      throw new Error("Bill not found");
    }

    const scan = JSON.parse(bill.scan as string);

    const item = scan.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    const claimer = item.claimers?.find((c) => c.id === user.id);
    if (claimer) {
      if (shares === 0) {
        item.claimers = item.claimers?.filter((c) => c.id !== user.id);
      } else {
        claimer.shares = shares;
      }
    } else if (shares > 0) {
      item.claimers = [...(item.claimers || []), { id: user.id, shares }];
    }

    this.sql.exec(
      "UPDATE bills SET scan = ? WHERE id = ?",
      JSON.stringify(scan),
      id,
    );
  }

  getUser(id: string) {
    const results = this.sql.exec(
      "SELECT id, name FROM users WHERE id = ?",
      id,
    );

    if (results.rowsRead === 0) {
      return null;
    }

    return results.one();
  }

  getUserPrivate(privateId: string) {
    const results = this.sql.exec(
      "SELECT id, name FROM users WHERE privateId = ?",
      privateId,
    );

    if (results.rowsRead === 0) {
      return null;
    }

    return results.one();
  }

  upsertUser(privateId: string, id: string, name: string) {
    const user = this.getUserPrivate(privateId);
    if (!user) {
      this.sql.exec(
        "INSERT INTO users (id, privateId, name) VALUES (?, ?, ?)",
        id,
        privateId,
        name,
      );
    } else {
      if (user.id !== id) {
        throw new Error("Public ID mismatch");
      }

      this.sql.exec(
        "UPDATE users SET name = ? WHERE privateId = ?",
        name,
        privateId,
      );
    }
  }
}
