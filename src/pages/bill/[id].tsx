import { useRouter } from "next/router";
import { useCallback, useEffect, useMemo, useState } from "react";

import Link from "next/link";
import styles from "./page.module.css";

const subscribeToUpdates = (id: string, options: { onUpdate: () => void }) => {
  let ws: WebSocket | null = null;
  let isClosed = false;

  const createWebSocket = () => {
    ws = new WebSocket(`/api/v1/bill/${id}/ws`);
    ws.onopen = () => {
      console.log("WebSocket connected");
      // Refresh the bill immediately after connection to make sure we did
      // not miss any updates.
      options.onUpdate();
    };
    ws.onmessage = (event) => {
      console.log(event);
      options.onUpdate();
    };
    ws.onclose = () => {
      const retryIntervalSeconds = 3;
      console.log("WebSocket closed");
      if (!isClosed) {
        console.log(
          `WebSocket closed, retrying in ${retryIntervalSeconds} seconds...`,
        );
        setTimeout(() => {
          createWebSocket();
        }, retryIntervalSeconds * 1000);
      }
    };
    ws.onerror = (error) => {
      console.error("WebSocket error", error);
    };
  };

  createWebSocket();

  return () => {
    isClosed = true;
    if (!ws) return;
    try {
      ws.close();
    } catch (error) {
      console.error("WebSocket close error", error);
    }
  };
};

const fetchBill = async (id: string) => {
  const response = await fetch(`/api/v1/bill/${id}`);

  if (response.status !== 200) {
    throw new Error(`${response.status} != 200: ${response.statusText}`);
  }

  try {
    return response.json();
  } catch (error) {
    throw new Error(`Failed to parse server response: ${error}`);
  }
};

const submitClaim = async (id: string, itemId: string, shares: number) => {
  const response = await fetch(`/api/v1/bill/${id}/claim/${itemId}`, {
    method: "POST",
    body: JSON.stringify({ shares }),
  });

  if (response.status !== 200) {
    throw new Error(`${response.status} != 200: ${response.statusText}`);
  }
};

export default function BillPage() {
  const router = useRouter();
  const { id } = router.query;
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<any | null>(null);

  if (Array.isArray(id)) {
    return <div>Invalid bill ID</div>;
  }

  const refreshBill = useCallback(() => {
    if (!id) {
      return;
    }

    fetchBill(id)
      .then((data) => {
        setBill(data);
      })
      .catch((error) => {
        setError(`Error fetching bill ${id}: ${error}`);
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    refreshBill();
  }, [id, refreshBill]);

  useEffect(() => {
    if (!id) {
      return;
    }

    return subscribeToUpdates(id, { onUpdate: refreshBill });
  }, [id, refreshBill]);

  const handleClaim = (itemId: string) => {
    if (!id) {
      throw new Error("Bill ID is required");
    }

    const shares = prompt(
      `How many shares of this item do you want to claim?

If you claim for yourself, enter 1.

If you want to claim for yourself together with someone else, enter 2.`,
    );
    if (!shares) {
      return;
    }

    // If you want to limit your claim amount, enter a number between 0 and 1 which will cap your claim to that percentage of the item.`,

    let numericShares = parseInt(shares, 10);

    submitClaim(id, itemId, numericShares).catch((error) => {
      alert(`Error claiming item ${itemId}: ${error}`);
    });
  };

  const tallys = useMemo(() => {
    if (!bill) {
      return [];
    }

    let t: Record<
      string,
      {
        total: number;
        items: {
          name: string;
          amount: number;
          shares: number;
          totalShares: number;
        }[];
      }
    > = {};

    for (const item of bill.scan.items) {
      if (item.claimers) {
        const totalShares = item.claimers.reduce(
          (acc: number, v: any) => v.shares,
          0,
        );

        const shareValue = item.amount / totalShares;

        for (const claimer of item.claimers) {
          if (!t[claimer.id]) {
            t[claimer.id] = { total: 0, items: [] };
          }
          t[claimer.id].total += shareValue * claimer.shares;
          t[claimer.id].items.push({
            name: item.name,
            amount: shareValue * claimer.shares,
            shares: claimer.shares,
            totalShares: totalShares,
          });
        }
      }
    }

    return t;
  }, [bill]);

  return (
    <div>
      {isLoading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {bill && (
        <>
          <div className={styles.billHeader}>
            <div className={styles.billHeaderText}>
              <h2 className={styles.billName}>
                <Link href={`/bill/${id}`}>
                  {bill.name} <small>🔗</small>
                </Link>
              </h2>
              <p>{bill.date}</p>
            </div>
            <a
              className={styles.billImageLink}
              href={`/api/v1/bill/${id}/image`}
            >
              <img
                className={styles.billImage}
                src={`/api/v1/bill/${id}/image`}
              />
            </a>
          </div>
          <div className={`section`}>
            <table className={styles.billItems}>
              <thead>
                <tr>
                  <th className={styles.billItemName}>Name</th>
                  <th className={styles.billItemAmount}>Amount</th>
                  <th className={styles.billItemClaimers}>Claimers</th>
                </tr>
              </thead>
              <tbody>
                {bill.scan.items.map((item: any, index: number) => (
                  <tr
                    key={index}
                    className={
                      item.claimers.length > 0 ? "" : styles.billItemHighlight
                    }
                  >
                    <td className={styles.billItemName}>{item.name}</td>
                    <td className={styles.billItemAmount}>{item.amount}</td>
                    <td className={styles.billItemClaimers}>
                      {item.claimers?.map((claimer: any, index: number) => (
                        <span key={claimer.id}>
                          {claimer.id} ({claimer.shares})
                          {index < item.claimers.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </td>
                    <td className={styles.billItemClaimers}>
                      {item.autoClaimed ? (
                        "Auto-claimed"
                      ) : (
                        <>
                          <button onClick={() => handleClaim(item.id)}>
                            I'm in!
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTopWidth: "2px" }}>
                  <td
                    className={styles.billItemName}
                    style={{ fontWeight: "bold" }}
                  >
                    Bill total
                  </td>
                  <td className={styles.billItemAmount}>{bill.total_amount}</td>
                  <td
                    style={{
                      borderBottomStyle: "hidden",
                      borderRightStyle: "hidden",
                    }}
                  ></td>
                  <td
                    style={{
                      borderBottomStyle: "hidden",
                      borderRightStyle: "hidden",
                    }}
                  ></td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className={`section`}>
            <h3 className={`margin-bottom-1`}>Tally</h3>
            <p className={`margin-bottom-1`}>
              <i>
                Note: Numbers will be final once everyone finished claiming.
              </i>
            </p>
            <ul>
              {Object.entries(tallys).map(([id, tally]) => (
                <li key={id}>
                  {/*<abbr title="in progress...">⏳</abbr> */}
                  <strong>{id}</strong> claimed <code>{tally.total}</code>
                  <ul>
                    {tally.items.map((item) => (
                      <li key={item.name}>
                        {item.name} (
                        <code>
                          {item.shares}/{item.totalShares} = {item.amount}
                        </code>
                        )
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
