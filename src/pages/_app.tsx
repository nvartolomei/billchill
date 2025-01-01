import { User, UserContext } from "@/componenets/Contexts";
import Head from "next/head";
import { useRouter } from "next/router";
import { useCallback, useEffect, useState } from "react";

import "./globals.css";
import styles from "./layout.module.css";
import Link from "next/link";

const upsertUser = async (privateId: string, id: string, name: string) => {
  const response = await fetch("/api/v1/user", {
    method: "POST",
    body: JSON.stringify({ privateId, id, name }),
  });

  if (!response.ok) {
    throw new Error("Failed to upsert user");
  }
};

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = router.pathname;
  const isHome = pathname === "/";

  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const user = localStorage.getItem("user");
    if (user) {
      setUser(JSON.parse(user));
    }
  }, [setUser]);

  const login = useCallback(
    (e: React.MouseEvent<HTMLAnchorElement>) => {
      e.preventDefault();

      const name = prompt("Enter your name");
      if (!name) return;

      let newUser: User | null = null;
      if (user) {
        newUser = {
          ...user,
          name,
        };
      } else {
        newUser = {
          id: crypto.randomUUID(),
          privateId: crypto.randomUUID(),
          name,
        };
      }

      upsertUser(newUser.privateId, newUser.id, newUser.name)
        .then(() => {
          localStorage.setItem("user", JSON.stringify(newUser));
          setUser(newUser);
        })
        .catch((error) => {
          alert(error.message);
        });
    },
    [user],
  );

  return (
    <>
      <Head>
        <title>BillChill</title>
      </Head>
      <div className={styles.layout}>
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
      </div>
    </>
  );
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export default function App({ Component, pageProps }: any) {
  return (
    <Layout>
      <Component {...pageProps} />
    </Layout>
  );
}
