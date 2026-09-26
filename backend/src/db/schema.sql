PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS mentors (
  id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE,
  timezone TEXT NOT NULL DEFAULT 'Asia/Kolkata',
  max_daily_slots INTEGER NOT NULL DEFAULT 2 CHECK (max_daily_slots BETWEEN 1 AND 2)
);
CREATE TABLE IF NOT EXISTS parents (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, timezone TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS bookings (
  id TEXT PRIMARY KEY, parent_id TEXT NOT NULL REFERENCES parents(id),
  mentor_id INTEGER NOT NULL REFERENCES mentors(id),
  utc_start_time TEXT NOT NULL, utc_end_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'confirmed' CHECK (status = 'confirmed'),
  meeting_link TEXT NOT NULL, created_at TEXT NOT NULL,
  request_key TEXT NOT NULL UNIQUE, request_fingerprint TEXT NOT NULL,
  CHECK (utc_end_time > utc_start_time)
);
CREATE INDEX IF NOT EXISTS booking_mentor_time ON bookings(mentor_id, utc_start_time, utc_end_time);
CREATE TABLE IF NOT EXISTS email_previews (
  id TEXT PRIMARY KEY, booking_id TEXT NOT NULL REFERENCES bookings(id),
  recipient TEXT NOT NULL, subject TEXT NOT NULL, body TEXT NOT NULL,
  delivery_mode TEXT NOT NULL DEFAULT 'preview'
);
CREATE TABLE IF NOT EXISTS email_outbox (
  preview_id TEXT PRIMARY KEY REFERENCES email_previews(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sending', 'sent', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  next_attempt_at TEXT NOT NULL,
  lease_until TEXT,
  sent_at TEXT,
  last_error TEXT
);
CREATE INDEX IF NOT EXISTS outbox_due ON email_outbox(status, next_attempt_at);
