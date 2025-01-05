import { User, UserContext } from "@/componenets/Contexts";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import "./globals.css";
import styles from "./layout.module.css";
import Link from "next/link";

const getId = async (privateId: string) => {
  const response = await fetch("/api/v1/id", {
    method: "GET",
    headers: {
      Authorization: `Bearer ${privateId}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      return null;
    }
    throw new Error("Failed to get user");
  }

  return response.json();
};

const upsertUser = async (privateId: string | null, name: string) => {
  const response = await fetch("/api/v1/user", {
    method: "POST",
    headers: privateId
      ? {
          Authorization: `Bearer ${privateId}`,
        }
      : {},
    body: JSON.stringify({ name }),
  });

  if (!response.ok) {
    throw new Error("Failed to upsert user");
  }

  return response.json();
};

const AuthGuard = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = router.pathname;
  const isHome = pathname === "/";

  const [user, setUser] = useState<User | null>(null);

  const login = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement> | null) => {
      e?.preventDefault();

      const name = prompt("Enter your name");
      if (!name) return;

      upsertUser(user?.privateId || null, name)
        .then((user) => {
          localStorage.setItem("user", JSON.stringify(user));
          setUser(user as User);
        })
        .catch((error) => {
          alert(error.message);
        });
    },
    [user],
  );

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      getId(JSON.parse(user).privateId)
        .then((user) => {
          if (!user) {
            login(null);
          }
          setUser(user as User);
        })
        .catch((error) => {
          alert(error.message);
        });
    } else {
      login(null);
    }
  }, [setUser]);
  if (!user) {
    return (
      <>
        <Spinner />
      </>
    );
  }

  return (
    <>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <Link href="/">BillChill {isHome ? "" : "↩︎"}</Link>
        </h1>
        <div>
          {!user && (
            <a href="#" onClick={login}>
              Unknown user 🙋, login?
            </a>
          )}
          {user && (
            <a href="#" onClick={login}>
              💁 {user.name}
            </a>
          )}
        </div>
      </div>
      <UserContext.Provider value={user}>{children}</UserContext.Provider>
    </>
  );
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Head>
        <title>BillChill</title>
      </Head>
      <div className={styles.layout}>{children}</div>
    </>
  );
};

const Spinner = () => {
  return <div className={styles.spinner}></div>;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function App({ Component, pageProps }: any) {
  return (
    <Layout>
      <AuthGuard>
        <Component {...pageProps} />
      </AuthGuard>
    </Layout>
  );
}
