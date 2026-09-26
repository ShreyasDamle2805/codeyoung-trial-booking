import React from "react";
import { ArrowRight, Check, ExternalLink, Mail } from "lucide-react";

export function Confirmation({ booking, heading, onReset }) {
  const smtp = booking.notificationMode === "smtp";
  return (
    <div className="card confirmation">
      <span className="success-icon">
        <Check size={30} />
      </span>
      <span className="eyebrow">LET THE DISCOVERY BEGIN</span>
      <h2 tabIndex={-1} ref={heading}>
        You’re all booked!
      </h2>
      <p>Your child’s next “I did it!” is on the calendar.</p>
      <div className="confirmation-times">
        <div>
          <span>YOUR LOCAL TIME</span>
          <strong>{booking.parent.localTime}</strong>
          <p className="duration-note">30-minute class</p>
        </div>
        <div>
          <span>YOUR MENTOR · {booking.mentor.name}</span>
          <strong>{booking.mentor.localTime}</strong>
        </div>
      </div>
      <a className="primary" href={booking.meetingLink}>
        Open demo classroom <ExternalLink size={17} />
      </a>
      <div className="notice">
        <Mail size={19} />
        <p>
          <strong>
            {smtp
              ? "Your confirmations are queued"
              : "Confirmation previews are ready"}
          </strong>
          {smtp
            ? "We’ll email you and your mentor. Your booking is confirmed even if the messages take a moment to arrive."
            : "This demo saves email previews for both of you; it doesn’t send email."}
        </p>
      </div>
      <details>
        <summary>View parent & mentor email previews</summary>
        {booking.emailPreviews.map((preview, index) => (
          <article className="email-preview" key={index}>
            <strong>To: {preview.recipient}</strong>
            <p>{preview.subject}</p>
            <pre>{preview.body}</pre>
          </article>
        ))}
      </details>
      <p className="booking-reference">Booking reference: {booking.id}</p>
      <button className="text-button" onClick={onReset}>
        Book another trial <ArrowRight size={15} />
      </button>
    </div>
  );
}
