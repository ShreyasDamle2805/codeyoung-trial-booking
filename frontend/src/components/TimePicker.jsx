import React from "react";
import { DateTime } from "luxon";
import { ArrowRight, Globe2, ShieldCheck } from "lucide-react";
import { Calendar } from "./Calendar";

const commonZones = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Asia/Kolkata",
];
const supportedZones = Intl.supportedValuesOf?.("timeZone") || [];
export function TimePicker({
  date,
  timezone,
  selected,
  onDate,
  onZone,
  onSelect,
  onContinue,
  availability,
}) {
  const zones = [...new Set([timezone, ...commonZones, ...supportedZones])];
  const { slots, loading, error, refresh } = availability;
  return (
    <>
      <label className="timezone-label" htmlFor="timezone">
        <Globe2 size={15} /> YOUR TIMEZONE
      </label>
      <select
        id="timezone"
        value={timezone}
        onChange={(event) => onZone(event.target.value)}
        aria-describedby="timezone-help"
      >
        {zones.map((zone) => (
          <option key={zone} value={zone}>
            {zone.replaceAll("_", " ")}
          </option>
        ))}
      </select>
      <p className="timezone-help" id="timezone-help">
        All times below are local to you. Daylight saving is handled
        automatically.
      </p>
      <Calendar
        key={timezone}
        date={date}
        timezone={timezone}
        onSelect={onDate}
      />
      <div className="slot-heading">
        <h3 id="times-heading">Available times</h3>
        <span>{DateTime.fromISO(date).toFormat("ccc, LLL d")}</span>
      </div>
      <div
        className="slots"
        role="group"
        aria-labelledby="times-heading"
        aria-busy={loading}
      >
        {loading ? (
          <p className="empty" role="status">
            Finding your next adventure…
          </p>
        ) : slots.some((slot) => slot.available > 0) ? (
          slots.map((slot) => (
            <button
              type="button"
              key={slot.start}
              disabled={!slot.available}
              className={selected?.start === slot.start ? "chosen" : ""}
              aria-pressed={selected?.start === slot.start}
              onClick={() => onSelect(slot)}
            >
              <span>{slot.label}</span>
              <small>{slot.offset}</small>
            </button>
          ))
        ) : (
          !error && (
            <p className="empty" role="status">
              No times available on this day. Try another date to find your
              perfect moment.
            </p>
          )
        )}
      </div>
      {error && (
        <div className="error" role="alert">
          {error}
          <button type="button" onClick={refresh}>
            Try again
          </button>
        </div>
      )}
      <button
        type="button"
        className="primary"
        disabled={!selected || loading}
        onClick={onContinue}
      >
        Continue <ArrowRight size={18} />
      </button>
      <p className="under-button">
        <ShieldCheck size={13} /> Free trial · No credit card needed
      </p>
    </>
  );
}
