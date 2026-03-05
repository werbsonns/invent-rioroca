import Database from "better-sqlite3";
const db = new Database("inventory.db");
try {
    console.log("--- ALL TRIGGERS ---");
    const triggers = db.prepare("SELECT name, tbl_name, sql FROM sqlite_master WHERE type='trigger'").all();
    if (triggers.length > 0) {
        triggers.forEach(t => console.log(`Trigger: ${t.name} on Table: ${t.tbl_name}\nSQL: ${t.sql}\n`));
    } else {
        console.log("No triggers found in the database.");
    }
} catch (err) {
    console.error("Error:", err.message);
} finally {
    db.close();
}
