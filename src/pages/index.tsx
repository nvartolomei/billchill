import { UserContext } from "@/componenets/Contexts";
import { useRouter } from "next/router";
import { useCallback, useContext, useRef, useState } from "react";

const scanBill = (
  privateUserId: string,
  name: string,
  file: File,
): Promise<{ id: string }> => {
  const formData = new FormData();
  formData.append("name", name);
  formData.append("file", file);
  return fetch("/api/v1/scan", {
    method: "POST",
    body: formData,
    headers: {
      Authorization: `Bearer ${privateUserId}`,
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(response.statusText);
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
      return data as { id: string };
    });
};

const BillScanner = ({ onScan }: { onScan: (id: string) => void }) => {
  const fileRef = useRef<HTMLInputElement>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const user = useContext(UserContext);

  const uploadCallback = useCallback(
    (file: File) => {
      if (!user) {
        return;
      }

      setIsLoading(true);
      setError(null);

      const name = prompt(
        "Enter a name for the bill so it is easily recognizable",
      );
      if (!name || name === "") {
        setError("Name is required");
        setIsLoading(false);
        return;
      }

      scanBill(user.privateId, name, file)
        .then((data) => {
          onScan(data.id);
        })
        .catch((error) => {
          setError(`Failed to scan the bill: ${error.message}`);
          setIsLoading(false);
        });
    },
    [onScan],
  );

  const handleFileChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (file) {
        uploadCallback(file);
      }
    },
    [uploadCallback],
  );

  const handleRetry = useCallback(() => {
    if (fileRef.current?.files?.[0]) {
      uploadCallback(fileRef.current.files[0]);
    }
  }, [uploadCallback]);

  return (
    <div>
      <p>Upload your bill to get started.</p>
      <input
        ref={fileRef}
        disabled={isLoading}
        type="file"
        onChange={handleFileChange}
        accept="image/*"
        style={{ padding: "1rem 0" }}
      />
      {isLoading && <p>Scanning...</p>}
      {error && (
        <>
          <p>{error}</p>
          <button onClick={handleRetry}>Retry</button>
        </>
      )}
    </div>
  );
};

export default function Home() {
  const router = useRouter();

  const handleScan = (id: string) => {
    router.push(`/bill/${id}`);
  };

  return <BillScanner onScan={handleScan} />;
}
