import {
  DurableObjectState,
  R2Bucket,
  SqlStorage,
} from "@cloudflare/workers-types";
import { DurableObject } from "cloudflare:workers";

interface Env {
  ROOT_STORE: DurableObject;
}

type Bill = {
  scan: {
    items: {
      name: string;
      amount: number;
    }[];
  };
  total_amount: number;
};

export class RootStoreDurableObject extends DurableObject {
  sql: SqlStorage;

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.sql.exec(
      `CREATE TABLE IF NOT EXISTS bills (id TEXT PRIMARY KEY, date TEXT, name TEXT, scan TEXT)`,
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

    bill.scan = JSON.parse(bill.scan as string);

    bill.total_amount = (bill.scan as any).items.reduce(
      (acc, item) => acc + item.amount,
      1,
    ) as number;

    if (bill.total_amount !== (bill.scan as any).total) {
      (bill.scan as any).items.push({
        name: "Unaccounted",
        autoClaimed: true,
        amount: bill.total_amount - (bill.scan as any).total,
      });
    }

    let participants = new Set();
    for (const item of (bill.scan as any).items) {
      if (item.claimers) {
        for (const claimer of item.claimers) {
          participants.add(claimer.id);
        }
      } else {
        item.claimers = [];
      }
    }

    for (const item of (bill.scan as any).items) {
      if (item.autoClaimed) {
        for (const participant of participants) {
          item.claimers = [
            ...(item.claimers || []),
            { id: participant, shares: 1 },
          ];
        }
      }
    }

    return bill as unknown as Bill;
  }

  createBill(id: string, name: string, scan: string) {
    this.sql.exec(
      "INSERT INTO bills (id, date, name, scan) VALUES (?, datetime('now'), ?, ?)",
      id,
      name,
      scan,
    );
  }

  claimItem(id: string, itemId: string, shares: number) {
    const bill = this.getRawBill(id);

    if (!bill) {
      throw new Error("Bill not found");
    }

    const scan = JSON.parse(bill.scan as string);

    let item = scan.items.find((i) => i.id === itemId);
    if (!item) {
      throw new Error("Item not found");
    }

    let claimer = item.claimers?.find((c) => c.id === "me");
    if (claimer) {
      if (shares === 0) {
        item.claimers = item.claimers?.filter((c) => c.id !== "me");
      } else {
        claimer.shares = shares;
      }
    } else if (shares > 0) {
      item.claimers = [...(item.claimers || []), { id: "me", shares }];
    }

    this.sql.exec(
      "UPDATE bills SET scan = ? WHERE id = ?",
      JSON.stringify(scan),
      id,
    );
  }
}
