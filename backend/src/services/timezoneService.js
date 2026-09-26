import { DateTime, IANAZone } from "luxon";

export class AppError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}
export const utc = (dt) => dt.toUTC().toISO();
export function validateZone(zone) {
  if (typeof zone !== "string" || !IANAZone.isValidZone(zone))
    throw new AppError(
      400,
      "INVALID_TIMEZONE",
      "Choose a valid IANA timezone.",
    );
  return zone;
}
export function localLabel(iso, zone) {
  return (
    DateTime.fromISO(iso)
      .setZone(zone)
      .toFormat("ccc, dd LLL yyyy 'at' h:mm a ZZZZ '(UTC'ZZ')'") + ` · ${zone}`
  );
}
export function dayBounds(date, zone) {
  validateZone(zone);
  if (typeof date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new AppError(400, "INVALID_DATE", "Choose a valid calendar date.");
  const start = DateTime.fromISO(date, { zone }).startOf("day");
  if (!start.isValid || start.toISODate() !== date)
    throw new AppError(400, "INVALID_DATE", "Choose a valid calendar date.");
  return [start, start.plus({ days: 1 })];
}
export function parseStart(value) {
  if (typeof value !== "string" || !/Z$/.test(value))
    throw new AppError(
      400,
      "INVALID_TIME",
      "Start time must be an ISO timestamp in UTC ending in Z.",
    );
  const dt = DateTime.fromISO(value, { setZone: true });
  if (!dt.isValid || dt.second || dt.millisecond || dt.minute % 30)
    throw new AppError(400, "INVALID_TIME", "Choose a valid 30-minute slot.");
  return dt.toUTC();
}
