import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

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

  return response
    .json()
    .catch((error) =>
      Promise.reject(
        Error(`Failed to parse server response: ${error.message}`),
      ),
    );
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

  const handleClaim = () => {
    const shares = prompt(
      `How many shares of this item do you want to claim?
If you claim for yourself, enter 1.
If you want to claim for yourself together with someone else, enter 2.`,
    );
    if (!shares) {
      return;
    }

    console.log(shares);
  };

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
                  <tr key={index} className={styles.billItem}>
                    <td className={styles.billItemName}>{item.name}</td>
                    <td className={styles.billItemAmount}>{item.amount}</td>
                    <td className={styles.billItemClaimers}>
                      <button onClick={handleClaim}>I'm in!</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className={`section`}>
            <h3 className={`section-title`}>Claimers</h3>
            <p className={`margin-bottom-1`}>
              <i>Numbers will be final when everyone finished claiming.</i>
            </p>
            <ul>
              <li>
                <abbr title="in progress...">⏳</abbr> <strong>foo</strong>{" "}
                claiming, ~$10 so far
              </li>
              <li>
                <abbr title="Done">✅</abbr> <strong>bar</strong> claimed ~$10
              </li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
