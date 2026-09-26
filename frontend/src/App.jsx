import React, { useEffect, useRef, useState } from "react";
import { DateTime } from "luxon";
import {
  ArrowRight,
  Check,
  Clock3,
  Globe2,
  ShieldCheck,
  Sparkles,
  Video,
} from "lucide-react";
import { Brand, Intro } from "./components/Marketing";
import { TimePicker } from "./components/TimePicker";
import { BookingForm } from "./components/BookingForm";
import { Confirmation } from "./components/Confirmation";
import { useAvailability } from "./hooks/useAvailability";
import { useBooking } from "./hooks/useBooking";
import { api } from "./api";

export function App() {
  const demo = window.location.pathname.startsWith("/demo/");
  const [timezone, setTimezone] = useState(
    () =>
      Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York",
  );
  const [date, setDate] = useState(() =>
    DateTime.now().setZone(timezone).plus({ days: 1 }).toISODate(),
  );
  const [selected, setSelected] = useState(null);
  const [step, setStep] = useState(1);
  const [name, setName] = useState(""),
    [email, setEmail] = useState("");
  const [mailMode, setMailMode] = useState(null);
  const availability = useAvailability(date, timezone, !demo);
  const booking = useBooking();
  const heading = useRef(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step, booking.booking]);
  useEffect(() => {
    const controller = new AbortController();
    api("/config", { signal: controller.signal })
      .then((config) => setMailMode(config.mailMode))
      .catch(() => {});
    return () => controller.abort();
  }, []);
  function back() {
    setStep(1);
    setSelected(null);
    booking.clearError();
    availability.refresh();
  }
  function changeZone(zone) {
    setTimezone(zone);
    setSelected(null);
    const today = DateTime.now().setZone(zone).toISODate();
    if (date < today) setDate(today);
  }
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to booking
      </a>
      <header>
        <div className="header-inner">
          <Brand />
          <span className="header-note">
            A little curiosity. A world of possibilities.
          </span>
          <span className="header-safe">
            <ShieldCheck size={16} /> Made for young minds
          </span>
        </div>
      </header>
      {demo ? (
        <main id="main" className="demo card">
          <span className="success-icon">
            <Video />
          </span>
          <h1>Your next adventure starts here.</h1>
          <p>
            This is a demo classroom link. In a live product, your mentor would
            meet you here.
          </p>
          <a className="primary" href="/">
            Back to booking <ArrowRight size={18} />
          </a>
        </main>
      ) : (
        <main className="layout">
          <Intro />
          <section
            id="main"
            className="booking-area"
            aria-label="Book your trial class"
          >
            {booking.booking ? (
              <Confirmation
                booking={booking.booking}
                heading={heading}
                onReset={() => {
                  booking.reset();
                  back();
                }}
              />
            ) : (
              <div className="card">
                <div className="card-top">
                  <span className="trial-tag">
                    <Sparkles size={14} /> YOUR FREE TRIAL
                  </span>
                  <span className="duration">
                    <Clock3 size={14} /> 30 min
                  </span>
                </div>
                <h2 tabIndex={-1} ref={heading}>
                  {step === 1
                    ? "Make time for a little magic."
                    : "Let’s make it official."}
                </h2>
                <p className="card-subtitle">
                  {step === 1
                    ? "Pick a day and time. We’ll find an available mentor."
                    : "Just a couple of details, and you’re on your way."}
                </p>
                <div className="steps" aria-label={`Step ${step} of 2`}>
                  <span className={step === 1 ? "active" : "complete"}>
                    <b>{step > 1 ? <Check size={13} /> : "1"}</b> Choose a time
                  </span>
                  <i />
                  <span className={step === 2 ? "active" : ""}>
                    <b>2</b> Your details
                  </span>
                </div>
                {step === 1 ? (
                  <TimePicker
                    date={date}
                    timezone={timezone}
                    selected={selected}
                    availability={availability}
                    onDate={(date) => {
                      setDate(date);
                      setSelected(null);
                    }}
                    onZone={changeZone}
                    onSelect={setSelected}
                    onContinue={() => {
                      setStep(2);
                      booking.clearError();
                    }}
                  />
                ) : (
                  <BookingForm
                    selected={selected}
                    timezone={timezone}
                    name={name}
                    email={email}
                    setName={setName}
                    setEmail={setEmail}
                    busy={booking.busy}
                    error={booking.error}
                    mailMode={mailMode}
                    onBack={back}
                    onSubmit={() =>
                      booking.book({
                        name,
                        email,
                        timezone,
                        start: selected.start,
                      })
                    }
                  />
                )}
              </div>
            )}
            <p className="booking-footer">
              <Globe2 size={14} /> Different timezones. The same love of
              learning.
            </p>
          </section>
        </main>
      )}
      <footer>
        <Brand />
        <span>A brighter future starts with curiosity.</span>
        <span>Assignment demo · 2026</span>
      </footer>
    </>
  );
}
