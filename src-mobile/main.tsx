import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./mobile.css";

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    void navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("GreebleFS Mobile: failed to register service worker", error);
    });
  });
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
