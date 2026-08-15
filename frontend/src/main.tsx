import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

// Service worker: caches the app shell for fast repeat loads and an offline
// fallback. Never registered against API/WS traffic (see public/sw.js) so
// it can't serve stale matches or interfere with the WebSocket connection.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((err) => {
      // Non-fatal — the app works fully without the service worker, it just
      // loses offline/installability. Log and move on rather than block render.
      console.warn("Service worker registration failed:", err);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
