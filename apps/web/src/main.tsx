// Muss als Erstes laufen, bevor Module mit zod-Schemas geladen werden.
import "./zod-config";
import "./styles/index.css";

import { QueryClientProvider } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";

import { createQueryClient } from "./app/query-client";
import { router } from "./app/router";
import { initSession } from "./features/auth/session";

const queryClient = createQueryClient();

// Sitzung sofort wiederherstellen, parallel zum ersten Rendern.
void initSession();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
