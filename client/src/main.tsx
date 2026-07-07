import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { registerSW } from "virtual:pwa-register";
import App from "./App";
import { queryClient } from "./lib/queryClient";
import { ErrorBoundary } from "./components/system/ErrorBoundary";
import { UpdatePrompt } from "./components/system/UpdatePrompt";
import "./styles/index.css";

const updateSW = registerSW({
  onNeedRefresh() {
    window.dispatchEvent(new CustomEvent("phantom:sw-update"));
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent("phantom:sw-offline-ready"));
  },
});

// expose so UpdatePrompt can trigger the reload
(window as unknown as { __updateSW?: (reload?: boolean) => Promise<void> }).__updateSW = updateSW;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <App />
          <UpdatePrompt />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
