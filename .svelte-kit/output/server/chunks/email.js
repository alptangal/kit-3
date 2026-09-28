var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class DevTransport {
  get outbox() {
    const g = globalThis;
    return g.__devOutbox ?? (g.__devOutbox = []);
  }
  async send(message) {
    return;
  }
  readOutbox() {
    return this.outbox;
  }
}
class SmtpTransport {
  constructor(config) {
    __publicField(this, "config");
    this.config = config;
  }
  async send(message) {
    throw new Error(
      `SmtpTransport.send() not implemented (would send to ${message.to} via ${this.config.host}:${this.config.port}). Configure a real transport or use DevTransport.`
    );
  }
}
const devTransport = new DevTransport();
function createTransport() {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? "587");
  const user = process.env.SMTP_USER ?? "";
  const pass = process.env.SMTP_PASS ?? "";
  const from = process.env.SMTP_FROM ?? user;
  if (host) return new SmtpTransport({ host, port, user, pass, from });
  return devTransport;
}
const service = {
  async sendEmail(message) {
    await createTransport().send(message);
  },
  getOutbox() {
    return devTransport.readOutbox();
  }
};
function sendDevEmail(to, subject, html) {
  service.sendEmail({ to, subject, html }).catch((e) => console.error("[email] send failed:", e));
}
export {
  sendDevEmail as s
};
