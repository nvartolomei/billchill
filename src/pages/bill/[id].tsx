import { useRouter } from "next/router";
import { useEffect, useState } from "react";

export default function BillPage() {
  const router = useRouter();
  const { id } = router.query;

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [bill, setBill] = useState<object | null>(null);

  useEffect(() => {
    fetch(`/api/v1/bill/${id}`)
      .then((response) =>
        response
          .json()
          .catch((error) =>
            Promise.reject(
              Error(`Failed to parse server response: ${error.message}`),
            ),
          ),
      )
      .then((data) => {
        setBill(data);
        setIsLoading(false);
      })
      .catch((error) => {
        setIsLoading(false);
        setError(`Error fetching bill ${id}: ${error}`);
      });
  }, [id]);

  return (
    <div>
      Bill {id}
      {isLoading && <p>Loading...</p>}
      {error && <p>{error}</p>}
      {bill && <p>{JSON.stringify(bill)}</p>}
    </div>
  );
}
