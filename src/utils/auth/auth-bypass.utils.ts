import { env } from "../../config/env";

export const isAuthBypassEnabled = () => {
  return env.NODE_ENV === "development" && env.BYPASS_AUTH === "true";
};

export const getDevUser = () => ({
  id: "dev-user-id",
  role: "admin",
});