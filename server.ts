import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

import fs from "fs";
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === "production"
  ? path.join("/tmp", "inventory.db")
  : path.join(__dirname, "inventory.db");

// In production (Vercel), copy the initial database to /tmp if it doesn't exist
if (process.env.NODE_ENV === "production" && !fs.existsSync(dbPath)) {
  const initialDbPath = path.join(process.cwd(), "inventory.db");
  if (fs.existsSync(initialDbPath)) {
    fs.copyFileSync(initialDbPath, dbPath);
  }
}

const db = new Database(dbPath);

// Initialize database
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
const skuCount = db.prepare("SELECT COUNT(*) as count FROM skus").get() as { count: number };
if (skuCount.count === 0) {
  const insertSku = db.prepare("INSERT INTO skus (name, fase) VALUES (?, ?)");
  insertSku.run("Parafuso Sextavado 1/2", "Almoxarifado");
  insertSku.run("Porca Zincada M8", "Almoxarifado");
  insertSku.run("Trena Métrica 5m", "Produção");
  insertSku.run("Tinta Acrílica Branca", "Pintura");
}

export const app = express();

async function configureApp() {
  app.use(express.json());

  // API Routes
  app.get("/api/skus", (req, res) => {
    const skus = db.prepare("SELECT * FROM skus ORDER BY name ASC").all();
    res.json(skus);
  });

  app.post("/api/skus", (req, res) => {
    const { name, fase } = req.body;
    try {
      const info = db.prepare("INSERT INTO skus (name, fase) VALUES (?, ?)").run(name, fase);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.put("/api/skus/:id", (req, res) => {
    const { name, fase } = req.body;
    try {
      db.prepare("UPDATE skus SET name = ?, fase = ? WHERE id = ?").run(name, fase, req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.delete("/api/skus/:id", (req, res) => {
    try {
      db.prepare("DELETE FROM entries WHERE sku_id = ?").run(req.params.id);
      db.prepare("DELETE FROM skus WHERE id = ?").run(req.params.id);
      res.json({ success: true });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/entries", (req, res) => {
    const entries = db.prepare(`
      SELECT entries.*, skus.name as sku_name, skus.fase as fase
      FROM entries 
      JOIN skus ON entries.sku_id = skus.id 
      ORDER BY entries.timestamp DESC
    `).all();
    res.json(entries);
  });

  app.post("/api/entries", (req, res) => {
    const { sku_id, date, shift, car_number, quantity } = req.body;
    try {
      const info = db.prepare(`
        INSERT INTO entries (sku_id, date, shift, car_number, quantity) 
        VALUES (?, ?, ?, ?, ?)
      `).run(sku_id, date, shift, car_number, quantity);
      res.json({ id: info.lastInsertRowid });
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  });

  app.get("/api/stats", (req, res) => {
    const total = db.prepare("SELECT SUM(quantity) as total FROM entries").get() as { total: number };
    res.json({ total: total.total || 0 });
  });

  // Vite middleware for development
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

if (process.env.NODE_ENV !== "production" || import.meta.url === `file://${process.argv[1]}`) {
  configureApp().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
} else {
  configureApp();
}

export default app;


