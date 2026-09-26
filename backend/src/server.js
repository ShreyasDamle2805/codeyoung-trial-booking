import { openDatabase } from "./db/connection.js";
import { createApp } from "./app.js";
import { loadProjectEnv, loadConfig } from "./config.js";
import { createEmailDispatcher } from "./services/emailService.js";
loadProjectEnv();
const config = loadConfig();
const db = openDatabase(undefined, config);
const { port, host } = config;
const dispatcher = createEmailDispatcher(db, config);
const flush = () =>
  dispatcher
    .flush()
    .catch(() =>
      console.error("Email dispatcher failed; pending messages remain queued."),
    );
const timer = config.mailMode === "smtp" ? setInterval(flush, 5000) : null;
if (timer) {
  timer.unref();
  void flush();
}
const server = createApp(db, undefined, config).listen(port, host, () =>
  console.log(`Booking app: http://localhost:${port}`),
);
let stopping = false;
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => {
    if (stopping) return;
    stopping = true;
    clearInterval(timer);
    server.close(async () => {
      await flush();
      dispatcher.close();
      db.close();
      process.exit(0);
    });
  });
