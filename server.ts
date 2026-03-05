import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === "production"
  ? path.join("/tmp", "inventory.db")
  : path.join(__dirname, "inventory.db");

let db: any;

async function initDb() {
  if (db) return db;

  console.log(`initDb: NODE_ENV=${process.env.NODE_ENV}, dbPath=${dbPath}`);

  // In production (Vercel), copy the initial database to /tmp if it doesn't exist
  if (process.env.NODE_ENV === "production" && !fs.existsSync(dbPath)) {
    const initialDbPath = path.join(process.cwd(), "inventory.db");
    console.log(`initDb: Checking for initial DB at: ${initialDbPath}`);
    if (fs.existsSync(initialDbPath)) {
      try {
        fs.copyFileSync(initialDbPath, dbPath);
        console.log(`initDb: Copied DB to: ${dbPath}`);
      } catch (err) {
        console.error(`initDb: Failed to copy DB:`, err);
      }
    } else {
      console.warn(`initDb: Initial DB not found at: ${initialDbPath}`);
    }
  }

  try {
    console.log("initDb: Loading better-sqlite3...");
    const { default: Database } = await import("better-sqlite3");
    db = new Database(dbPath);
    console.log(`initDb: Database connected at: ${dbPath}`);

    // Initialize schema
    db.exec(`
      CREATE TABLE IF NOT EXISTS skus (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        fase TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS entries (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku_id INTEGER NOT NULL,
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        car_number TEXT,
        quantity INTEGER NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (sku_id) REFERENCES skus (id)
      );
    `);

    // Seed initial data if empty
    const { count } = db.prepare("SELECT COUNT(*) as count FROM skus").get() as { count: number };
    if (count === 0) {
      const insertSku = db.prepare("INSERT INTO skus (name, fase) VALUES (?, ?)");
      insertSku.run("Parafuso Sextavado 1/2", "Almoxarifado");
      insertSku.run("Porca Zincada M8", "Almoxarifado");
      insertSku.run("Trena Métrica 5m", "Produção");
      insertSku.run("Tinta Acrílica Branca", "Pintura");
    }
    return db;
  } catch (err: any) {
    console.error("ERROR in initDb:", err);
    throw err;
  }
}

export const app = express();
app.use(express.json());

// API Routes
app.get("/api/skus", async (req, res) => {
  try {
    const database = await initDb();
    const skus = database.prepare("SELECT * FROM skus ORDER BY name ASC").all();
    res.json(skus);
  } catch (err: any) {
    console.error("GET /api/skus error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/skus", async (req, res) => {
  const { name, fase } = req.body;
  try {
    const database = await initDb();
    const info = database.prepare("INSERT INTO skus (name, fase) VALUES (?, ?)").run(name, fase);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    console.error("POST /api/skus error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/skus/:id", async (req, res) => {
  const { name, fase } = req.body;
  try {
    const database = await initDb();
    database.prepare("UPDATE skus SET name = ?, fase = ? WHERE id = ?").run(name, fase, req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("PUT /api/skus/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/skus/:id", async (req, res) => {
  try {
    const database = await initDb();
    database.prepare("DELETE FROM entries WHERE sku_id = ?").run(req.params.id);
    database.prepare("DELETE FROM skus WHERE id = ?").run(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    console.error("DELETE /api/skus/:id error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/entries", async (req, res) => {
  try {
    const database = await initDb();
    const entries = database.prepare(`
      SELECT entries.*, skus.name as sku_name, skus.fase as fase
      FROM entries 
      JOIN skus ON entries.sku_id = skus.id 
      ORDER BY entries.timestamp DESC
    `).all();
    res.json(entries);
  } catch (err: any) {
    console.error("GET /api/entries error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/entries", async (req, res) => {
  const { sku_id, date, shift, car_number, quantity } = req.body;
  try {
    const database = await initDb();
    const info = database.prepare(`
        INSERT INTO entries (sku_id, date, shift, car_number, quantity) 
        VALUES (?, ?, ?, ?, ?)
      `).run(sku_id, date, shift, car_number, quantity);
    res.json({ id: info.lastInsertRowid });
  } catch (err: any) {
    console.error("POST /api/entries error:", err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const database = await initDb();
    const total = database.prepare("SELECT SUM(quantity) as total FROM entries").get() as { total: number };
    res.json({ total: total.total || 0 });
  } catch (err: any) {
    console.error("GET /api/stats error:", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug", (req, res) => {
  try {
    const filesInCwd = fs.existsSync(process.cwd()) ? fs.readdirSync(process.cwd()) : [];
    const filesInTmp = fs.existsSync("/tmp") ? fs.readdirSync("/tmp") : [];
    res.json({
      env: process.env.NODE_ENV,
      cwd: process.cwd(),
      dbPath,
      dbExists: fs.existsSync(dbPath),
      filesInCwd,
      filesInTmp,
      dirname: __dirname,
      dbIsInitialized: !!db,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function configureVite() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(process.cwd(), "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(process.cwd(), "dist", "index.html"));
    });
  }
}

const PORT = Number(process.env.PORT) || 3000;

process.on('uncaughtException', (err) => {
  console.error('UNCAUGHT EXCEPTION:', err);
});

if (process.env.NODE_ENV !== "production" || import.meta.url === `file://${process.argv[1]}`) {
  configureVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  if (process.env.NODE_ENV === "production") {
    app.use(express.static(path.join(process.cwd(), "dist")));
  }
}

export default app;


