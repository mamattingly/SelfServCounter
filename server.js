import express from "express";
import session from "express-session";
import connectPgSimple from "connect-pg-simple";
import pg from "pg";
import bcrypt from "bcryptjs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const server = createServer(app);
const { Pool } = pg;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required.");
if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) throw new Error("SESSION_SECRET must be set to a random secret of at least 32 characters.");
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined });
const PgStore = connectPgSimple(session);
const sessionMiddleware = session({
  store: new PgStore({ pool, tableName: "user_sessions", createTableIfMissing: true }),
  secret: process.env.SESSION_SECRET, resave: false, saveUninitialized: false,
  cookie: { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", maxAge: 1000 * 60 * 60 * 12 },
});
app.set("trust proxy", 1);\napp.use(express.json({ limit: "1mb" }));
app.use(sessionMiddleware);
app.use((req, res, next) => { res.setHeader("X-Content-Type-Options", "nosniff"); res.setHeader("X-Frame-Options", "DENY"); res.setHeader("Referrer-Policy", "same-origin"); next(); });

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_users (
      id BIGSERIAL PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'editor' CHECK (role IN ('admin','editor','viewer')),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS people (
      id BIGSERIAL PRIMARY KEY, name TEXT NOT NULL UNIQUE, counter INTEGER NOT NULL DEFAULT 0 CHECK (counter >= 0),
      position INTEGER NOT NULL DEFAULT 0
    );
  `);
  const { rows } = await pool.query("SELECT COUNT(*)::int AS count FROM app_users");
  if (rows[0].count === 0) {
    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password || password.length < 12) throw new Error("First run requires ADMIN_EMAIL and ADMIN_PASSWORD (at least 12 characters) to create the initial admin account.");
    await pool.query("INSERT INTO app_users(email,password_hash,role) VALUES($1,$2,'admin')", [email, await bcrypt.hash(password, 12)]);
    console.log("Created initial administrator account from environment variables.");
  }
}
const sockets = new Set();
const eventClients = new Map();
function broadcast(message) {
  const payload = JSON.stringify(message);
  for (const ws of sockets) if (ws.readyState === 1) ws.send(payload);
  for (const res of eventClients.keys()) { try { res.write("data: " + payload + "\\n\\n"); } catch { eventClients.delete(res); } }
}
app.get("/api/events", requireAuth, async (req,res) => {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache, no-transform");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();
  eventClients.set(res, Number(req.user.id));
  res.write("data: " + JSON.stringify({type:"people", people: await getPeople()}) + "\\n\\n");
  req.on("close", () => eventClients.delete(res));
});
async function getPeople() {
  const { rows } = await pool.query("SELECT name, counter FROM people ORDER BY position, id");
  return rows.map(p => ({ name: p.name, counter: p.counter }));
}
async function requireAuth(req,res,next) {
  if (!req.session.user) return res.status(401).json({ error: "Please sign in." });
  const { rows } = await pool.query("SELECT id,email,role FROM app_users WHERE id=$1", [req.session.user.id]);
  if (!rows.length) { req.session.destroy(()=>{}); return res.status(401).json({ error: "Session expired. Please sign in again." }); }
  req.user = rows[0]; next();
}
function requireEditor(req,res,next) {
  if (!["admin","editor"].includes(req.user.role)) return res.status(403).json({ error: "Your account is read-only." });
  next();
}
function requireAdmin(req,res,next) {
  if (req.user.role !== "admin") return res.status(403).json({ error: "Administrator access is required." });
  next();
}
app.get("/api/health", (_req,res) => res.json({ ok: true }));
app.get("/api/session", async (req,res) => {
  if (!req.session.user) return res.json({ user: null });
  const { rows } = await pool.query("SELECT id,email,role FROM app_users WHERE id=$1", [req.session.user.id]);
  if (!rows.length) { req.session.destroy(()=>{}); return res.json({ user: null }); }
  res.json({ user: rows[0] });
});
app.post("/api/login", async (req,res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (email.length > 254 || password.length > 1024) return res.status(400).json({ error: "Invalid email or password." });
  const { rows } = await pool.query("SELECT id,email,password_hash,role FROM app_users WHERE email=$1", [email]);
  const user = rows[0];
  const valid = user ? await bcrypt.compare(password, user.password_hash) : await bcrypt.compare(password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidinvalid");
  if (!user || !valid) return res.status(401).json({ error: "Email or password is incorrect." });
  req.session.regenerate(err => {
    if (err) return res.status(500).json({ error: "Unable to start session." });
    req.session.user = { id: user.id };
    req.session.save(saveErr => saveErr ? res.status(500).json({ error: "Unable to save session." }) : res.json({ user: { id: user.id, email: user.email, role: user.role } }));
  });
});
app.post("/api/logout", requireAuth, (req,res) => req.session.destroy(err => {
  res.clearCookie("connect.sid", { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
  if (err) return res.status(500).json({ error: "Unable to sign out." });
  res.json({ ok: true });
}));
app.get("/api/people", requireAuth, async (_req,res) => res.json({ people: await getPeople() }));
app.post("/api/people/actions", requireAuth, requireEditor, async (req,res) => {
  const { type } = req.body || {};
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    if (type === "add") {
      const name = String(req.body.name || "").trim();
      if (!name || name.length > 100) throw Object.assign(new Error("Name must be between 1 and 100 characters."), { status: 400 });
      await client.query("INSERT INTO people(name,counter,position) VALUES($1,0,(SELECT COALESCE(MAX(position),-1)+1 FROM people))", [name]);
    } else if (type === "delete") {
      await client.query("DELETE FROM people WHERE name=$1", [String(req.body.name || "")]);
    } else if (type === "increment" || type === "decrement") {
      const delta = type === "increment" ? 1 : -1;
      await client.query("UPDATE people SET counter=GREATEST(0,counter+$2) WHERE name=$1", [String(req.body.name || ""), delta]);
    } else if (type === "reset") {
      await client.query("UPDATE people SET counter=0");
    } else if (type === "replace") {
      if (!Array.isArray(req.body.people) || req.body.people.length > 5000) throw Object.assign(new Error("Invalid people list."), { status: 400 });
      const seen = new Set();
      const clean = req.body.people.map((p, i) => {
        const name = String(p?.name || "").trim();
        const counter = Number(p?.counter ?? 0);
        const key = name.toLocaleLowerCase();
        if (!name || name.length > 100 || !Number.isSafeInteger(counter) || counter < 0 || seen.has(key)) throw Object.assign(new Error("Names must be unique and counts must be whole numbers of zero or greater."), { status: 400 });
        seen.add(key); return { name, counter, position: i };
      });
      await client.query("DELETE FROM people");
      for (const p of clean) await client.query("INSERT INTO people(name,counter,position) VALUES($1,$2,$3)", [p.name,p.counter,p.position]);
    } else throw Object.assign(new Error("Unknown action."), { status: 400 });
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    if (err.code === "23505") return res.status(409).json({ error: "That name already exists." });
    return res.status(err.status || 500).json({ error: err.status ? err.message : "Unable to update shared data." });
  } finally { client.release(); }
  const people = await getPeople();
  broadcast({ type: "people", people });
  res.json({ people });
});
app.get("/api/users", requireAuth, requireAdmin, async (_req,res) => {
  const { rows } = await pool.query("SELECT id,email,role,created_at FROM app_users ORDER BY email");
  res.json({ users: rows });
});
app.post("/api/users", requireAuth, requireAdmin, async (req,res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const role = ["admin","editor","viewer"].includes(req.body?.role) ? req.body.role : "viewer";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 12 || password.length > 1024) return res.status(400).json({ error: "Password must be at least 12 characters." });
  try {
    const { rows } = await pool.query("INSERT INTO app_users(email,password_hash,role) VALUES($1,$2,$3) RETURNING id,email,role,created_at", [email,await bcrypt.hash(password,12),role]);
    res.status(201).json({ user: rows[0] });
  } catch (err) {
    if (err.code === "23505") return res.status(409).json({ error: "That email already has an account." });
    res.status(500).json({ error: "Unable to create account." });
  }
});
app.delete("/api/users/:id", requireAuth, requireAdmin, async (req,res) => {
  const id = Number(req.params.id);
  if (id === Number(req.user.id)) return res.status(400).json({ error: "You cannot delete your own account." });
  const { rowCount } = await pool.query("DELETE FROM app_users WHERE id=$1", [id]);
  if (!rowCount) return res.status(404).json({ error: "Account not found." });
  res.json({ ok: true });
});

const dist = path.join(__dirname, "dist");
app.use(express.static(dist, { index: false }));
app.get("*", (req,res,next) => {
  if (req.path.startsWith("/api/")) return res.status(404).json({ error: "API route not found." });
  res.sendFile(path.join(dist,"index.html"), err => err && next(err));
});
const port = Number(process.env.PORT || 10000);
await initDb();
server.listen(port,"0.0.0.0",()=>console.log(`SelfServ Counter listening on ${port}`));
