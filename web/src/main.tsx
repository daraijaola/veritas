import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import App from "./App.tsx";
import "./styles.css";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

// Public Sui mainnet fullnode — no API key needed in the browser
// (Tatum is used server-side only, where we have the API key)
const networks = {
  mainnet: { url: "https://fullnode.mainnet.sui.io:443" },
};

/** Wipe any stale wallet/dapp-kit localStorage keys that can cause a blank
 *  page on fresh visits — especially after a failed wallet handshake. */
function clearStaleDappKitStorage() {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (
        key &&
        (key.startsWith("mysten") ||
          key.startsWith("sui-dapp") ||
          key.startsWith("wallet-standard") ||
          key.startsWith("WalletConnect") ||
          key.startsWith("wc@") ||
          key === "preferred-wallet")
      ) {
        keysToRemove.push(key);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch {
    // localStorage may be blocked (private mode) — ignore
  }
}

// Run immediately on every page load — clears any stale wallet state
// that would crash the app before React even mounts
clearStaleDappKitStorage();


/** React Error Boundary — catches render crashes and shows a recovery UI. */
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; errMsg: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errMsg: "" };
  }

  static getDerivedStateFromError(error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return { hasError: true, errMsg: msg };
  }

  handleReset = () => {
    clearStaleDappKitStorage();
    this.setState({ hasError: false, errMsg: "" });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: "100dvh",
            background: "#11110f",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: "system-ui, sans-serif",
            color: "#faf9f5",
            padding: "2rem",
            textAlign: "center",
            gap: "1.5rem",
          }}
        >
          <svg width="48" height="48" viewBox="0 0 64 64" fill="none">
            <path
              d="M13 31 L27 46 L53 13"
              stroke="#d4f75a"
              strokeWidth="6"
              strokeLinecap="square"
              strokeLinejoin="miter"
            />
          </svg>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              Something went wrong
            </div>
            <div style={{ fontSize: "0.85rem", color: "rgba(250,249,245,0.5)", maxWidth: 320 }}>
              A wallet or network error caused the app to crash. Tap below to
              clear the cache and reload.
            </div>
          </div>
          <button
            onClick={this.handleReset}
            style={{
              background: "#d4f75a",
              color: "#11110f",
              border: "none",
              borderRadius: "6px",
              padding: "0.75rem 1.5rem",
              fontWeight: 700,
              fontSize: "0.95rem",
              cursor: "pointer",
            }}
          >
            Clear cache &amp; retry
          </button>
          {this.state.errMsg && (
            <div
              style={{
                fontSize: "0.7rem",
                color: "rgba(250,249,245,0.25)",
                maxWidth: 320,
                wordBreak: "break-all",
              }}
            >
              {this.state.errMsg}
            </div>
          )}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <SuiClientProvider networks={networks} defaultNetwork="mainnet">
          <WalletProvider autoConnect>
            <App />
          </WalletProvider>
        </SuiClientProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
