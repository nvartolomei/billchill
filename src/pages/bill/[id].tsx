import { useRouter } from "next/router";
import { useEffect, useState } from "react";

import styles from "./page.module.css";
import Link from "next/link";

export default function BillPage() {
  const router = useRouter();
  const { id } = router.query;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<any | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }

    fetch(`/api/v1/bill/${id}`)
      .then((response) => {
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
      })
      .then((data) => {
        setBill(data);
        setIsLoading(false);
      })
      .catch((error) => {
        setIsLoading(false);
        setError(`Error fetching bill ${id}: ${error}`);
      });
  }, [id, setBill, setIsLoading, setError]);

  useEffect(() => {
    if (!id) {
      return;
    }

    const ws = new WebSocket(`/api/v1/bill/${id}/ws`);
    ws.onopen = () => {
      console.log("WebSocket connected");
    };
    ws.onmessage = (event) => {
      console.log(event);
    };
    ws.onclose = () => {
      console.log("WebSocket closed");
    };
    ws.onerror = (error) => {
      console.error("WebSocket error", error);
    };

    return () => {
      try {
        console.log("closing");
        ws.close();
      } catch (error) {
        console.error("WebSocket close error", error);
      }
    };
  }, [id]);

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
