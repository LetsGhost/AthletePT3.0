import { Outlet } from "react-router";

import { Toaster } from "@/components/ui/toast";
import { useSession } from "@/features/auth/session";
import { useApplyTheme } from "@/features/settings/theme";

export function RootLayout() {
  const role = useSession((state) => state.user?.role);
  useApplyTheme(role);

  return (
    <>
      <Outlet />
      <Toaster />
    </>
  );
}
