import express from "express";
import { sql } from "@vercel/postgres";

// Load environment variables locally if not injected
if (process.env.NODE_ENV !== "production") {
  const dotenv = await import("dotenv");
  dotenv.config();
}

export const app = express();
app.use(express.json());

// Helper function to initialize database tables
async function initDb() {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS skus (
        id SERIAL PRIMARY KEY,
        name TEXT NOT NULL,
        fase TEXT NOT NULL
      );
    `;
    await sql`
      CREATE TABLE IF NOT EXISTS entries (
        id SERIAL PRIMARY KEY,
        sku_id INTEGER NOT NULL REFERENCES skus(id),
        date TEXT NOT NULL,
        shift TEXT NOT NULL,
        car_number TEXT,
        quantity INTEGER NOT NULL,
        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Seed if empty
    const { rows: skuRows } = await sql`SELECT COUNT(*) FROM skus`;
    if (parseInt(skuRows[0].count) === 0) {
      await sql`INSERT INTO skus (name, fase) VALUES ('Item Inicial', 'Produção')`;
    }
    return true;
  } catch (err) {
    console.error("Failed to init Postgres db:", err);
    throw err;
  }
}

// Call initDb when starting server
initDb().catch(console.error);

// API Routes
app.get("/api/skus", async (req, res) => {
  try {
    const { rows } = await sql`SELECT * FROM skus ORDER BY name ASC`;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.post("/api/skus", async (req, res) => {
  try {
    const { name, fase = "Produção" } = req.body;
    const { rows } = await sql`INSERT INTO skus (name, fase) VALUES (${name}, ${fase}) RETURNING id`;
    res.json({ id: rows[0].id });
  } catch (err: any) {
    console.error("Error saving SKU:", err);
    res.status(400).json({ error: err.message });
  }
});

app.put("/api/skus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { name, fase } = req.body;
    await sql`UPDATE skus SET name = ${name}, fase = ${fase} WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error updating SKU:", err);
    res.status(400).json({ error: err.message });
  }
});

app.delete("/api/skus/:id", async (req, res) => {
  try {
    const { id } = req.params;
    
    // Check if there are entries using this SKU
    const { rows: entriesCountRows } = await sql`SELECT COUNT(*) FROM entries WHERE sku_id = ${id}`;
    if (parseInt(entriesCountRows[0].count) > 0) {
      throw new Error("Não é possível excluir um SKU que possui registros de apontamento.");
    }
    
    await sql`DELETE FROM skus WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting SKU:", err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/entries", async (req, res) => {
  try {
    const { rows } = await sql`
      SELECT entries.*, skus.name as sku_name, skus.fase as fase
      FROM entries 
      JOIN skus ON entries.sku_id = skus.id 
      ORDER BY entries.timestamp DESC
    `;
    res.json(rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.delete("/api/entries/:id", async (req, res) => {
  try {
    const { id } = req.params;
    await sql`DELETE FROM entries WHERE id = ${id}`;
    res.json({ success: true });
  } catch (err: any) {
    console.error("Error deleting entry:", err);
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/entries", async (req, res) => {
  try {
    const { sku_id, date, shift, car_number, quantity } = req.body;
    const { rows } = await sql`
      INSERT INTO entries (sku_id, date, shift, car_number, quantity) 
      VALUES (${sku_id}, ${date}, ${shift}, ${car_number}, ${quantity}) 
      RETURNING id
    `;
    res.json({ id: rows[0].id });
  } catch (err: any) {
    console.error("Error saving entry:", err);
    res.status(400).json({ error: err.message });
  }
});

app.get("/api/stats", async (req, res) => {
  try {
    const { rows } = await sql`SELECT SUM(quantity) FROM entries`;
    res.json({ total: parseInt(rows[0].sum) || 0 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/debug", async (req, res) => {
  try {
    res.json({
      success: true,
      env: process.env.NODE_ENV,
      db: "postgres",
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


