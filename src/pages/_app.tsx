import Head from "next/head";
import "./globals.css";

import styles from "./layout.module.css";

const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <>
      <Head>
        <title>BillChill</title>
      </Head>
      <div className={styles.layout}>
        <h1>BillChill</h1>
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
