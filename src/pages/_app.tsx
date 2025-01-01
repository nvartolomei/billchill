import Head from "next/head";
import "./globals.css";

import styles from "./layout.module.css";
import { useRouter } from "next/router";

const Layout = ({ children }: { children: React.ReactNode }) => {
  const router = useRouter();
  const pathname = router.pathname;
  const isHome = pathname === "/";

  return (
    <>
      <Head>
        <title>BillChill</title>
      </Head>
      <div className={styles.layout}>
        <h1 className={styles.title}>
          <a href="/">BillChill {isHome ? "" : "↩︎"}</a>
        </h1>
        {children}
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
