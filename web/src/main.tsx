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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <SuiClientProvider networks={networks} defaultNetwork="mainnet">
        <WalletProvider autoConnect>
          <App />
        </WalletProvider>
      </SuiClientProvider>
    </QueryClientProvider>
  </React.StrictMode>,
);
