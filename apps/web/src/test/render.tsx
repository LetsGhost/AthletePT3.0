import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider } from "react-router";

import { createQueryClient } from "@/app/query-client";
import { routes } from "@/app/router";

/** Rendert die komplette App mit allen Routen an `path`. */
export function renderApp(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false } });
  const result = render(
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return { ...result, router };
}
