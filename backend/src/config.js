import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";

export function loadConfig(env = process.env) {
  const port = Number(env.PORT || 3001);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be between 1 and 65535.");
  const mode = env.MAIL_MODE || "preview";
  if (!["preview", "smtp"].includes(mode))
    throw new Error("MAIL_MODE must be preview or smtp.");
  const origin = new URL(env.APP_ORIGIN || `http://localhost:${port}`);
  if (
    !["http:", "https:"].includes(origin.protocol) ||
    origin.username ||
    origin.password ||
    origin.pathname !== "/" ||
    origin.search ||
    origin.hash
  )
    throw new Error(
      "APP_ORIGIN must be an HTTP(S) origin without a path, credentials, query, or fragment.",
    );
  const smtpPort = Number(env.SMTP_PORT || 1025);
  if (
    mode === "smtp" &&
    (!env.SMTP_HOST ||
      !Number.isInteger(smtpPort) ||
      smtpPort < 1 ||
      smtpPort > 65535)
  )
    throw new Error("SMTP mode requires SMTP_HOST and a valid SMTP_PORT.");
  if (Boolean(env.SMTP_USER) !== Boolean(env.SMTP_PASSWORD))
    throw new Error("Set both SMTP_USER and SMTP_PASSWORD, or neither.");
  const mentorEmails = env.MENTOR_EMAILS?.split(",").map((email) =>
    email.trim(),
  );
  if (
    mentorEmails &&
    (mentorEmails.length !== 10 ||
      new Set(mentorEmails).size !== 10 ||
      mentorEmails.some(
        (email) => !/^[^\s@,<>]+@[^\s@,<>]+\.[^\s@,<>]+$/.test(email),
      ))
  )
    throw new Error(
      "MENTOR_EMAILS must contain ten unique comma-separated email addresses.",
    );
  return {
    port,
    host: env.HOST || "127.0.0.1",
    appOrigin: origin.origin,
    mailMode: mode,
    mentorEmails,
    mailFrom: env.MAIL_FROM || "Codeyoung Trial Demo <trial@example.com>",
    smtp: {
      host: env.SMTP_HOST,
      port: smtpPort,
      secure: env.SMTP_SECURE === "true",
      requireTLS: env.SMTP_REQUIRE_TLS === "true",
      ...(env.SMTP_USER
        ? { auth: { user: env.SMTP_USER, pass: env.SMTP_PASSWORD } }
        : {}),
      connectionTimeout: 10000,
      greetingTimeout: 10000,
      socketTimeout: 20000,
      disableFileAccess: true,
      disableUrlAccess: true,
    },
  };
}

export function loadProjectEnv() {
  const path = fileURLToPath(new URL("../../.env", import.meta.url));
  if (existsSync(path)) loadEnvFile(path);
}
