import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { About } from "./About";
import "./styles.css";

/**
 * Hash routing, two routes, one bundle.
 *
 * A cold start lands on About, not on the analysis page: the tool is useless to
 * a reader who does not yet know what pulse detection is for, and About opens
 * with the figure that says so. The app itself is `#app`. `#about` still
 * resolves here — it is what every in-app link and the prerendered `/#about`
 * point at, and it must keep working.
 */
function Root() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => {
      setHash(window.location.hash);
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  return hash === "#app" ? (
    <App />
  ) : (
    <About onOpenApp={() => (window.location.hash = "#app")} />
  );
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Root />
  </StrictMode>,
);
