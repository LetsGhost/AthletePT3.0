// Muss als Erstes laufen, bevor Module mit zod-Schemas geladen werden.
import "./zod-config";
import "./styles/index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { clearCacheOnUserChange, createQueryClient } from "./app/query-client";
import { router } from "./app/router";
import { registerServiceWorker } from "./app/service-worker";
import { initSession } from "./features/auth/session";

const queryClient = createQueryClient();
clearCacheOnUserChange(queryClient);

// Sitzung sofort wiederherstellen, parallel zum ersten Rendern.
void initSession();
registerServiceWorker();
// Nach einem Deployment fehlen die Dateien der alten Version. Neu laden holt die aktuelle;
// laufende Trainings liegen im localStorage.
window.addEventListener("vite:preloadError", () => window.location.reload());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
