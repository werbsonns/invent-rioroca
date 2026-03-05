import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

import initSqlJs from "sql.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = process.env.NODE_ENV === "production"
  ? path.join("/tmp", "inventory.db")
  : path.join(__dirname, "inventory.db");

let dbInstance: any = null;

async function initDb() {
  if (dbInstance) return dbInstance;

  try {
    console.log("Initializing sql.js...");
    const wasmPath = path.join(process.cwd(), "node_modules", "sql.js", "dist", "sql-wasm.wasm");
    console.log("WASM path:", wasmPath, "Exists:", fs.existsSync(wasmPath));

    const SQL = await initSqlJs({
      locateFile: file => file.endsWith(".wasm") ? wasmPath : file
    });
    console.log("sql.js initialized successfully.");
    let data: Buffer | null = null;

    // Load from disk if exists
    if (fs.existsSync(dbPath)) {
      console.log(`Loading DB from disk: ${dbPath}`);
      data = fs.readFileSync(dbPath);
    } else if (process.env.NODE_ENV === "production") {
      // Try to find initial DB in bundle
      const initialPaths = [
        path.join(process.cwd(), "inventory.db"),
        path.join(__dirname, "..", "inventory.db"),
        path.join(__dirname, "inventory.db")
      ];
      for (const p of initialPaths) {
        if (fs.existsSync(p)) {
          console.log(`Loading initial DB from: ${p}`);
          data = fs.readFileSync(p);
          break;
        }
      }
    }

    dbInstance = new SQL.Database(data);
    console.log("SQL.Database instance created.");

    // Ensure schema
    dbInstance.run(`
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
    console.log("Schema checked/created.");

    // Sanity check
    const check = dbInstance.exec("SELECT 1");
    console.log("Sanity check result:", check);

    // Only seed if we didn't load existing data and table is empty
    const skusCount = dbInstance.exec("SELECT COUNT(*) FROM skus")[0]?.values[0][0];
    if (skusCount === 0) {
      dbInstance.run("INSERT INTO skus (name, fase) VALUES (?, ?)", ["Item Inicial", "Produção"]);
      saveDb();
    }

    return dbInstance;
  } catch (err) {
    console.error("Failed to init sql.js db:", err);
    throw err;
  }
}

function saveDb() {
  if (!dbInstance) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(dbPath, buffer);
    console.log(`DB saved to ${dbPath}`);
  } catch (err) {
    console.error("Failed to save DB:", err);
  }
}

// Helper to convert sql.js result to array of objects
function resultToObjects(res: any[]) {
  if (!res || res.length === 0) return [];
  const { columns, values } = res[0];
  return values.map((row: any[]) => {
    const obj: any = {};
    columns.forEach((col: string, i: number) => {
      obj[col] = row[i];
    });
    return obj;
  });
}

export const app = express();
app.use(express.json());

// API Routes
app.get("/api/skus", async (req, res) => {
  try {
    const db = await initDb();
    const result = db.exec("SELECT * FROM skus ORDER BY name ASC");
    res.json(resultToObjects(result));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/skus", async (req, res) => {
  try {
    const { name, fase = "Produção" } = req.body;
    const db = await initDb();
    db.run("INSERT INTO skus (name, fase) VALUES (?, ?)", [name, fase]);
    saveDb();
    const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.json({ id: lastId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/entries", async (req, res) => {
  try {
    const db = await initDb();
    const result = db.exec(`
      SELECT entries.*, skus.name as sku_name, skus.fase as fase
      FROM entries 
      JOIN skus ON entries.sku_id = skus.id 
      ORDER BY entries.timestamp DESC
    `);
    res.json(resultToObjects(result));
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/entries", async (req, res) => {
  try {
    const { sku_id, date, shift, car_number, quantity } = req.body;
    const db = await initDb();
    db.run(
      "INSERT INTO entries (sku_id, date, shift, car_number, quantity) VALUES (?, ?, ?, ?, ?)",
      [sku_id, date, shift, car_number, quantity]
    );
    saveDb();
    const lastId = db.exec("SELECT last_insert_rowid()")[0].values[0][0];
    res.json({ id: lastId });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const db = await initDb();
    const resValue = db.exec("SELECT SUM(quantity) FROM entries")[0]?.values[0][0];
    res.json({ total: resValue || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug", async (req, res) => {
  try {
    await initDb();
    res.json({
      success: true,
      lib: "sql.js",
      env: process.env.NODE_ENV,
      dbPath,
      dbExists: fs.existsSync(dbPath),
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


