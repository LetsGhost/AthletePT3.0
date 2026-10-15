import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";

/**
 * Liest das Token aus dem URL-Fragment (`#token=…`) und entfernt es danach aus der
 * Adresszeile, damit es nicht in Verlauf oder Screenshots landet.
 */
export function useTokenFromHash(): string | null {
  const { hash, pathname, search } = useLocation();
  const navigate = useNavigate();
  // Lesen muss rein sein: StrictMode ruft den Initializer doppelt auf.
  const [token] = useState(() => new URLSearchParams(hash.slice(1)).get("token"));

  useEffect(() => {
    if (hash) navigate({ pathname, search }, { replace: true });
  }, [hash, pathname, search, navigate]);

  return token;
}
