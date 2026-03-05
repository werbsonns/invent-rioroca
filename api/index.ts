import express from "express";
import path from "path";
import fs from "fs";
import initSqlJs from "sql.js";

const dbPath = process.env.NODE_ENV === "production"
    ? path.join("/tmp", "inventory.db")
    : path.join(process.cwd(), "inventory.db");

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
        if (fs.existsSync(dbPath)) {
            console.log(`Loading DB from disk: ${dbPath}`);
            data = fs.readFileSync(dbPath);
        } else if (process.env.NODE_ENV === "production") {
            const initialDbPath = path.join(process.cwd(), "inventory.db");
            if (fs.existsSync(initialDbPath)) {
                console.log(`Loading initial DB from bundle: ${initialDbPath}`);
                data = fs.readFileSync(initialDbPath);
            }
        }

        dbInstance = new SQL.Database(data);
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

        // Seed if empty
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
        fs.writeFileSync(dbPath, Buffer.from(data));
        console.log(`DB saved to ${dbPath}`);
    } catch (err) {
        console.error("Failed to save DB:", err);
    }
}

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
        console.error("Error saving SKU:", err);
        res.status(400).json({ error: err.message });
    }
});

app.put("/api/skus/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const { name, fase } = req.body;
        const db = await initDb();
        db.run("UPDATE skus SET name = ?, fase = ? WHERE id = ?", [name, fase, id]);
        saveDb();
        res.json({ success: true });
    } catch (err: any) {
        console.error("Error updating SKU:", err);
        res.status(400).json({ error: err.message });
    }
});

app.delete("/api/skus/:id", async (req, res) => {
    try {
        const { id } = req.params;
        const db = await initDb();
        // Check if there are entries using this SKU
        const entriesCount = db.exec("SELECT COUNT(*) FROM entries WHERE sku_id = ?", [id])[0]?.values[0][0];
        if (entriesCount > 0) {
            throw new Error("Não é possível excluir um SKU que possui registros de apontamento.");
        }
        db.run("DELETE FROM skus WHERE id = ?", [id]);
        saveDb();
        res.json({ success: true });
    } catch (err: any) {
        console.error("Error deleting SKU:", err);
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
        console.error("Error saving entry:", err);
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
            env: process.env.NODE_ENV,
            dbPath,
            dbExists: fs.existsSync(dbPath),
            cwd: process.cwd(),
            node: process.version
        });
    } catch (err: any) {
        res.status(500).json({ success: false, error: err.message });
    }
});

export default app;
