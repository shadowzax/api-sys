const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "users.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

const defaultProfilePicture = "https://i.ibb.co/HRbkkLw/3177440-1.jpg";

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            phone_number TEXT NOT NULL UNIQUE,
            profile_picture TEXT DEFAULT '${defaultProfilePicture}',
            password TEXT NOT NULL,
            account_type TEXT DEFAULT 'user',
            job_title TEXT DEFAULT '',
            account_status TEXT DEFAULT 'active',
            restaurant_id TEXT DEFAULT '1',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            advances TEXT DEFAULT '[]',
            expenses TEXT DEFAULT '[]',
            transfers TEXT DEFAULT '[]',
            fees TEXT DEFAULT '[]',
            dashboard_view INTEGER DEFAULT 0,
            outgoing_manage INTEGER DEFAULT 0,
            visa_manage INTEGER DEFAULT 0,
            transfers_manage INTEGER DEFAULT 0,
            advances_manage INTEGER DEFAULT 0,
            payments_manage INTEGER DEFAULT 0,
            accounts_manage INTEGER DEFAULT 0,
            logs_view INTEGER DEFAULT 0,
            settings_manage INTEGER DEFAULT 0,
            print_reports INTEGER DEFAULT 0
        )
    `);

    const requiredColumns = {
        name: "TEXT",
        email: "TEXT",
        phone_number: "TEXT",
        profile_picture: `TEXT DEFAULT '${defaultProfilePicture}'`,
        password: "TEXT",
        account_type: "TEXT DEFAULT 'user'",
        job_title: "TEXT DEFAULT ''",
        account_status: "TEXT DEFAULT 'active'",
        restaurant_id: "TEXT DEFAULT '1'",
        created_at: "DATETIME DEFAULT CURRENT_TIMESTAMP",
        advances: "TEXT DEFAULT '[]'",
        expenses: "TEXT DEFAULT '[]'",
        transfers: "TEXT DEFAULT '[]'",
        fees: "TEXT DEFAULT '[]'",
        dashboard_view: "INTEGER DEFAULT 0",
        outgoing_manage: "INTEGER DEFAULT 0",
        visa_manage: "INTEGER DEFAULT 0",
        transfers_manage: "INTEGER DEFAULT 0",
        advances_manage: "INTEGER DEFAULT 0",
        payments_manage: "INTEGER DEFAULT 0",
        accounts_manage: "INTEGER DEFAULT 0",
        logs_view: "INTEGER DEFAULT 0",
        settings_manage: "INTEGER DEFAULT 0",
        print_reports: "INTEGER DEFAULT 0"
    };

    db.all("PRAGMA table_info(users)", (err, columns) => {
        if (err) {
            console.error(err.message);
            return;
        }

        const existingColumns = columns.map(column => column.name);
        const columnEntries = Object.entries(requiredColumns);

        const addNextColumn = (index) => {
            if (index >= columnEntries.length) {
                db.run(`
                    UPDATE users
                    SET restaurant_id = '1'
                    WHERE restaurant_id IS NULL OR restaurant_id = ''
                `, (err) => {
                    if (err) {
                        console.error("Error updating existing users:", err.message);
                    } else {
                        console.log("Existing users updated successfully.");
                    }
                });

                return;
            }

            const [name, type] = columnEntries[index];

            if (existingColumns.includes(name)) {
                addNextColumn(index + 1);
                return;
            }

            db.run(
                `ALTER TABLE users ADD COLUMN ${name} ${type}`,
                (err) => {
                    if (err) {
                        console.error(`Error adding column ${name}:`, err.message);
                    }

                    addNextColumn(index + 1);
                }
            );
        };

        addNextColumn(0);
    });
});

function generateId() {
    return Math.floor(100000000 + Math.random() * 900000000).toString();
}

module.exports = {
    db,
    generateId
};
