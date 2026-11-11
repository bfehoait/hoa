import React from "react";
import "@fontsource-variable/manrope";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { App } from "./App";
import { AuthProvider } from "./data/auth";
import { InstallProvider } from "./data/install";
import { previewScope } from "./data/preview-scope";
import { accountPreview } from "./data/account-preview-client";
import "./styles/tokens.css";
import "./styles/global.css";
import "./styles/customer.css";
import "./styles/desktop.css";

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main className="fatal">
        <p className="eyebrow">Bellefort Estates</p>
        <h1>We couldn’t open this screen.</h1>
        <p>
          Reload to reopen this screen. If you just saved a change, check its
          status before submitting it again.
        </p>
        <button onClick={() => location.reload()}>Reload screen</button>
      </main>
    ) : (
      this.props.children
    );
  }
}
const client = new QueryClient({
  defaultOptions: { queries: { refetchOnWindowFocus: false } },
});
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <QueryClientProvider client={client}>
        <BrowserRouter
          basename={accountPreview?.basename ?? previewScope?.basename ?? "/"}
        >
          <AuthProvider>
            <InstallProvider>
              <App />
            </InstallProvider>
          </AuthProvider>
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  </React.StrictMode>,
);
