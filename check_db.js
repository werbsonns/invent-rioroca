import Database from "better-sqlite3";
const db = new Database("inventory.db");
try {
    console.log("--- TABLE SCHEMA ---");
    const tableSchema = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='skus'").get();
    console.log(tableSchema ? tableSchema.sql : "Table 'skus' not found");

    console.log("\n--- TRIGGERS ---");
    const triggers = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='trigger' AND tbl_name='skus'").all();
    if (triggers.length > 0) {
        triggers.forEach(t => console.log(`Trigger: ${t.name}\nSQL: ${t.sql}\n`));
    } else {
        console.log("No triggers found for 'skus'");
    }

    console.log("\n--- INDEXES ---");
    const indexes = db.prepare("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='skus'").all();
    indexes.forEach(i => console.log(`Index: ${i.name}\nSQL: ${i.sql}\n`));

} catch (err) {
    console.error("Error:", err.message);
} finally {
    db.close();
}
