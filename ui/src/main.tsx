import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

if (typeof globalThis !== "undefined") {
  const globalScope = globalThis as Record<string, unknown>;
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const debugFlag = metaEnv.DEBUG_FIX ?? metaEnv.VITE_DEBUG_FIX;
  if (debugFlag != null) {
    if (globalScope.DEBUG_FIX == null) {
      globalScope.DEBUG_FIX = debugFlag;
    }
    if (globalScope.__DEBUG_FIX__ == null) {
      globalScope.__DEBUG_FIX__ = debugFlag;
    }
  }
}

const rootElement = document.getElementById("root");

if (!rootElement) {
  throw new Error("Root element #root not found.");
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
