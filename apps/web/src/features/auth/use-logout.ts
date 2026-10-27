import { useNavigate } from "react-router";

import { logout } from "./session";

/** Abmelden und zum Login, auch wenn der Server nicht antwortet. */
export function useLogout() {
  const navigate = useNavigate();
  return async () => {
    await logout().catch(() => undefined);
    navigate("/login", { replace: true });
  };
}
