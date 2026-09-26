import React, { useState } from "react";
import { DateTime } from "luxon";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function Calendar({ date, timezone, onSelect }) {
  const today = DateTime.now().setZone(timezone).toISODate();
  const lastDay = DateTime.now()
    .setZone(timezone)
    .plus({ days: 30 })
    .toISODate();
  const [month, setMonth] = useState(() =>
    DateTime.fromISO(date).startOf("month"),
  );
  const gridStart = month.minus({ days: month.weekday % 7 });
  const monthKey = month.toFormat("yyyy-MM");
  return (
    <>
      <div className="calendar-heading">
        <h3 aria-live="polite">{month.toFormat("LLLL yyyy")}</h3>
        <div>
          <button
            type="button"
            aria-label="Previous month"
            disabled={monthKey <= today.slice(0, 7)}
            onClick={() => setMonth(month.minus({ months: 1 }))}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next month"
            disabled={monthKey >= lastDay.slice(0, 7)}
            onClick={() => setMonth(month.plus({ months: 1 }))}
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <div className="calendar">
        <div className="weekdays" aria-hidden="true">
          {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
            <span key={i}>{day}</span>
          ))}
        </div>
        <div className="days" role="group" aria-label="Choose a trial date">
          {Array.from({ length: 42 }, (_, i) => {
            const day = gridStart.plus({ days: i }),
              iso = day.toISODate();
            return (
              <button
                type="button"
                key={iso}
                disabled={
                  iso < today || iso > lastDay || day.month !== month.month
                }
                className={`${iso === date ? "selected" : ""} ${iso === today ? "today" : ""}`}
                aria-label={day.toFormat("cccc, LLLL d, yyyy")}
                aria-pressed={iso === date}
                aria-current={iso === today ? "date" : undefined}
                onClick={() => onSelect(iso)}
              >
                {day.day}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
