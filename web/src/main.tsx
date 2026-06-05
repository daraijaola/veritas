import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import App from "./App.tsx";
import "./styles.css";
import "@mysten/dapp-kit/dist/index.css";

const queryClient = new QueryClient();

// Use Tatum's RPC for Sui mainnet (key hackathon integration)
const TATUM_RPC = "https://sui-mainnet.gateway.tatum.io";

const networks = {
  mainnet: { url: TATUM_RPC },
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
