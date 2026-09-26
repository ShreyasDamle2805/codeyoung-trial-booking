import React from "react";
import { DateTime } from "luxon";
import { ArrowLeft, ArrowRight, CalendarDays, Sparkles } from "lucide-react";

export function BookingForm({
  selected,
  timezone,
  name,
  email,
  setName,
  setEmail,
  onBack,
  onSubmit,
  busy,
  error,
  mailMode,
}) {
  const picked = DateTime.fromISO(selected.start).setZone(timezone);
  const unavailable = [
    "NO_MENTORS_AVAILABLE",
    "OUTSIDE_BOOKING_WINDOW",
  ].includes(error?.code);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit();
      }}
      aria-busy={busy}
    >
      <div className="selected-summary">
        <CalendarDays size={22} />
        <div>
          <strong>{picked.toFormat("cccc, LLLL d")}</strong>
          <span>{picked.toFormat("h:mm a ZZZZ '(UTC'ZZ')'")} · 30 minutes</span>
          <small>{timezone}</small>
        </div>
        <button type="button" disabled={busy} onClick={onBack}>
          Change
        </button>
      </div>
      <label className="field">
        Parent’s name
        <input
          required
          autoComplete="name"
          maxLength={100}
          value={name}
          disabled={busy}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your full name"
        />
      </label>
      <label className="field">
        Email address
        <input
          required
          type="email"
          autoComplete="email"
          maxLength={254}
          value={email}
          disabled={busy}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          aria-describedby="email-help"
        />
      </label>
      <p className="details-help" id="email-help">
        We’ll prepare your class link and a confirmation with your local time.
      </p>
      <div className="notice">
        <Sparkles size={19} />
        <p>
          <strong>A mentor, matched just for you</strong>We’ll assign an
          available mentor when you confirm.
        </p>
      </div>
      {error && (
        <div className="error" role="alert">
          {error.message}
          {unavailable && (
            <button type="button" onClick={onBack}>
              Choose another time
            </button>
          )}
        </div>
      )}
      <button className="primary" disabled={busy || unavailable}>
        {busy ? "Confirming your trial…" : "Confirm my free trial"}
        <ArrowRight size={18} />
      </button>
      <p className="under-button">
        {mailMode === "smtp"
          ? "We’ll email a confirmation to you and your mentor."
          : mailMode === "preview"
            ? "Demo mode: confirmations are saved as email previews."
            : "Your class link will appear after confirmation."}
      </p>
      <button
        className="text-button"
        type="button"
        disabled={busy}
        onClick={onBack}
      >
        <ArrowLeft size={15} /> Back to times
      </button>
    </form>
  );
}
