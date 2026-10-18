import type { ComponentType } from "react";
import { createBrowserRouter, Navigate, type RouteObject } from "react-router";

import { AppShell } from "@/components/layout/app-shell";
import { PageSpinner } from "@/components/ui/spinner";
import { LoginPage } from "@/pages/login-page";
import { RouteErrorPage } from "@/pages/route-error-page";

import type { RouteHandle } from "./navigation";
import { HomeRedirect, PublicOnly, RenamedPath, RequireAuth, RequireRole } from "./guards";
import { RootLayout } from "./root-layout";

/**
 * Seiten werden erst beim Aufruf geladen (Code-Splitting). So lädt der Login nur, was er
 * braucht, und Bereiche anderer Rollen landen nie im Browser eines Athleten.
 */
const page = (load: () => Promise<{ default: ComponentType }>) => ({
  lazy: async () => ({ Component: (await load()).default }),
  HydrateFallback: PageSpinner,
});

/** Seiten mit breitem Inhalt (z. B. Plan-Editor mit Seitenspalte). */
const wide = { handle: { wide: true } satisfies RouteHandle };

const renamedProgress = <RenamedPath from="/progress" to="/entwicklung" />;

export const routes: RouteObject[] = [
  {
    element: <RootLayout />,
    errorElement: <RouteErrorPage />,
    children: [
      {
        element: <PublicOnly />,
        children: [
          { path: "/login", element: <LoginPage /> },
          { path: "/forgot-password", ...page(() => import("@/pages/forgot-password-page")) },
        ],
      },
      // Links aus Mails: funktionieren auch, wenn im Browser gerade jemand anderes angemeldet ist.
      { path: "/invite", ...page(() => import("@/pages/invite-page")) },
      { path: "/reset-password", ...page(() => import("@/pages/reset-password-page")) },
      { path: "/datenschutz", ...page(() => import("@/pages/privacy-page")) },
      {
        element: <RequireAuth />,
        children: [
          { index: true, element: <HomeRedirect /> },
          // Druckansicht ohne App-Rahmen
          {
            element: <RequireRole roles={["coach"]} />,
            children: [
              {
                path: "/coach/fragebogen",
                ...page(() => import("@/pages/coach/questionnaire-page")),
              },
            ],
          },
          {
            element: <AppShell />,
            children: [
              { path: "/settings", ...page(() => import("@/pages/settings-page")) },
              {
                element: <RequireRole roles={["athlete"]} />,
                children: [
                  { path: "/dashboard", ...page(() => import("@/pages/athlete/dashboard-page")) },
                  { path: "/plan", ...page(() => import("@/pages/athlete/plan-page")) },
                  { path: "/plan/:dayId", ...page(() => import("@/pages/athlete/plan-day-page")) },
                  {
                    path: "/plans/:planId",
                    ...page(() => import("@/pages/athlete/manage-plan-page")),
                    ...wide,
                  },
                  { path: "/workouts", ...page(() => import("@/pages/athlete/workouts-page")) },
                  {
                    path: "/entwicklung",
                    ...page(() => import("@/pages/athlete/progress-page")),
                  },
                  { path: "/progress/*", element: renamedProgress },
                  { path: "/progress", element: renamedProgress },
                  {
                    path: "/entwicklung/:exerciseId",
                    ...page(() => import("@/pages/athlete/exercise-progress-page")),
                  },
                  {
                    path: "/workouts/:logId",
                    ...page(() => import("@/pages/athlete/workout-page")),
                  },
                ],
              },
              {
                element: <RequireRole roles={["coach"]} />,
                children: [
                  { path: "/coach", element: <Navigate to="/coach/athletes" replace /> },
                  { path: "/coach/athletes", ...page(() => import("@/pages/coach/athletes-page")) },
                  {
                    path: "/coach/exercises",
                    ...page(() => import("@/pages/coach/exercises-page")),
                  },
                  {
                    path: "/coach/athletes/new",
                    ...page(() => import("@/pages/coach/new-athlete-page")),
                  },
                  {
                    path: "/coach/athletes/:id",
                    ...page(() => import("@/pages/coach/athlete-detail-page")),
                  },
                  {
                    path: "/coach/athletes/:id/entwicklung/:exerciseId",
                    ...page(() => import("@/pages/coach/exercise-progress-page")),
                  },
                  { path: "/coach/athletes/:id/progress/*", element: renamedProgress },
                  {
                    path: "/coach/athletes/:id/workouts/:logId",
                    ...page(() => import("@/pages/coach/workout-page")),
                  },
                  {
                    path: "/coach/athletes/:id/plans/:planId",
                    ...page(() => import("@/pages/coach/plan-page")),
                    ...wide,
                  },
                  {
                    path: "/coach/templates",
                    ...page(() => import("@/pages/coach/templates-page")),
                  },
                  {
                    path: "/coach/templates/:id",
                    ...page(() => import("@/pages/coach/template-page")),
                    ...wide,
                  },
                ],
              },
              {
                element: <RequireRole roles={["sysadmin"]} />,
                children: [
                  { path: "/admin", element: <Navigate to="/admin/coaches" replace /> },
                  { path: "/admin/coaches", ...page(() => import("@/pages/admin/coaches-page")) },
                  {
                    path: "/admin/exercises",
                    ...page(() => import("@/pages/admin/exercises-page")),
                  },
                ],
              },
              { path: "*", ...page(() => import("@/pages/not-found-page")) },
            ],
          },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
