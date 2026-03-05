import express from "express";
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

  try {
    // In production (Vercel), copy the initial database to /tmp if it doesn't exist
    if (process.env.NODE_ENV === "production" && !fs.existsSync(dbPath)) {
      const pathsToTry = [
        path.join(process.cwd(), "inventory.db"),
        path.join(__dirname, "..", "inventory.db"),
        path.join(__dirname, "inventory.db")
      ];

      let sourcePath = "";
      for (const p of pathsToTry) {
        if (fs.existsSync(p)) {
          sourcePath = p;
          break;
        }
      }

      if (sourcePath) {
        fs.copyFileSync(sourcePath, dbPath);
      }
    }

    const { default: Database } = await import("better-sqlite3");
    db = new Database(dbPath);

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
      insertSku.run("Item de Exemplo 1", "Almoxarifado");
      insertSku.run("Item de Exemplo 2", "Produção");
    }
    return db;
  } catch (err: any) {
    console.error("CRITICAL: Database initialization failed. Using in-memory fallback.", err);
    // Fallback Mock for stability on Vercel if native modules fail
    const mockDb = {
      isMock: true,
      error: err.message,
      data: { skus: [] as any[], entries: [] as any[] },
      prepare: (sql: string) => ({
        all: () => {
          if (sql.includes("FROM skus")) return mockDb.data.skus;
          if (sql.includes("FROM entries")) return mockDb.data.entries;
          return [];
        },
        run: (...args: any[]) => {
          if (sql.includes("INSERT INTO skus")) {
            const id = mockDb.data.skus.length + 1;
            mockDb.data.skus.push({ id, name: args[0], fase: args[1] });
            return { lastInsertRowid: id };
          }
          if (sql.includes("INSERT INTO entries")) {
            const id = mockDb.data.entries.length + 1;
            mockDb.data.entries.push({ id, sku_id: args[0], date: args[1], shift: args[2], car_number: args[3], quantity: args[4] });
            return { lastInsertRowid: id };
          }
          return { lastInsertRowid: 0 };
        },
        get: () => ({ total: 0, count: mockDb.data.skus.length })
      }),
      exec: () => { }
    };
    db = mockDb;
    return db;
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
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/skus", async (req, res) => {
  try {
    const { name, fase = "Produção" } = req.body;
    const database = await initDb();
    const info = database.prepare("INSERT INTO skus (name, fase) VALUES (?, ?)").run(name, fase);
    res.json({ id: info.lastInsertRowid, isMock: !!database.isMock });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/entries", async (req, res) => {
  try {
    const database = await initDb();
    const entries = database.prepare("SELECT * FROM entries ORDER BY timestamp DESC").all();
    res.json(entries);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/entries", async (req, res) => {
  try {
    const { sku_id, date, shift, car_number, quantity } = req.body;
    const database = await initDb();
    const info = database.prepare("INSERT INTO entries (sku_id, date, shift, car_number, quantity) VALUES (?, ?, ?, ?, ?)").run(sku_id, date, shift, car_number, quantity);
    res.json({ id: info.lastInsertRowid, isMock: !!database.isMock });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/debug", async (req, res) => {
  try {
    const database = await initDb();
    res.json({
      success: true,
      env: process.env.NODE_ENV,
      dbPath,
      dbExists: fs.existsSync(dbPath),
      isMock: !!database.isMock,
      dbError: database.error || null,
      cwd: process.cwd()
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

async function configureVite() {
  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  }
}

const PORT = Number(process.env.PORT) || 3000;

if (process.env.NODE_ENV !== "production" || import.meta.url === `file://${process.argv[1]}`) {
  configureVite().then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  });
}

export default app;


