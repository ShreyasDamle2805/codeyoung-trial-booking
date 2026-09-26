import { useRef, useState } from "react";
import { api } from "../api";

const storageKey = "codeyoung.confirmation";
function restoreConfirmation() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(storageKey));
    return saved?.id &&
      saved.parent &&
      saved.mentor &&
      Array.isArray(saved.emailPreviews)
      ? saved
      : null;
  } catch {
    return null;
  }
}
function persist(value) {
  try {
    if (value) sessionStorage.setItem(storageKey, JSON.stringify(value));
    else sessionStorage.removeItem(storageKey);
  } catch {
    /* Booking remains usable if the browser blocks session storage. */
  }
}

export function useBooking() {
  const [booking, setBooking] = useState(restoreConfirmation);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const inFlight = useRef(false);
  const request = useRef({ payload: "", key: "" });
  async function book(details) {
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError(null);
    const payload = JSON.stringify(details);
    if (request.current.payload !== payload)
      request.current = { payload, key: crypto.randomUUID() };
    try {
      const result = await api("/bookings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Idempotency-Key": request.current.key,
        },
        body: payload,
      });
      setBooking(result);
      persist(result);
    } catch (error) {
      setError({ code: error.code, message: error.message });
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }
  function reset() {
    request.current = { payload: "", key: "" };
    setBooking(null);
    persist(null);
    setError(null);
  }
  return {
    booking,
    busy,
    error,
    book,
    reset,
    clearError: () => setError(null),
  };
}
