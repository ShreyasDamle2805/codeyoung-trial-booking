import { useEffect, useState } from "react";
import { api } from "../api";

export function useAvailability(date, timezone, enabled = true) {
  const [state, setState] = useState({ slots: [], loading: true, error: "" });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    const controller = new AbortController();
    setState({ slots: [], loading: true, error: "" });
    api(`/slots?date=${date}&timezone=${encodeURIComponent(timezone)}`, {
      signal: controller.signal,
    })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ slots: data.slots, loading: false, error: "" });
      })
      .catch((error) => {
        if (!controller.signal.aborted)
          setState({ slots: [], loading: false, error: error.message });
      });
    return () => controller.abort();
  }, [date, timezone, version, enabled]);
  return { ...state, refresh: () => setVersion((value) => value + 1) };
}
