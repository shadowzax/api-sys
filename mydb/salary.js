const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dataFolder = path.join(__dirname, "..", "data");

if (!fs.existsSync(dataFolder)) {
    fs.mkdirSync(dataFolder, { recursive: true });
}

const dbPath = path.join(dataFolder, "salary.sqlite");

const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error(err.message);
    } else {
        console.log("Connected to database.");
    }
});

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS salary_files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            restaurant_id TEXT NOT NULL DEFAULT '1',
            created_at TEXT NOT NULL,
            employees TEXT NOT NULL DEFAULT '[]'
        )
    `);

    db.run(`
        ALTER TABLE salary_files
        ADD COLUMN restaurant_id TEXT NOT NULL DEFAULT '1'
    `, (err) => {
        if (err && !err.message.includes("duplicate column name")) {
            console.error(err.message);
        }
    });

    db.run(`
        UPDATE salary_files
        SET restaurant_id = '1'
        WHERE restaurant_id IS NULL OR restaurant_id = ''
    `);
});

function generateFileId() {
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function generateEmployeeId() {
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function createSalaryFile(name, restaurant_id = "1", employees = []) {
    return new Promise((resolve, reject) => {
        if (Array.isArray(restaurant_id)) {
            employees = restaurant_id;
            restaurant_id = "1";
        }

        restaurant_id = restaurant_id || "1";

        const fileId = generateFileId();
        const createdAt = new Date().toISOString();

        const formattedEmployees = employees.map((employee, index) => ({
            id: employee.id || generateEmployeeId(),
            code: employee.code || String(index + 1).padStart(3, "0"),
            name: employee.name || "",
            profession: employee.profession || "",
            monthlySalary: employee.monthlySalary || "0",
            salaryRecords: Array.isArray(employee.salaryRecords)
                ? employee.salaryRecords
                : [],
            advances: Array.isArray(employee.advances)
                ? employee.advances
                : []
        }));

        db.run(
            `
            INSERT INTO salary_files (
                id,
                name,
                restaurant_id,
                created_at,
                employees
            )
            VALUES (?, ?, ?, ?, ?)
            `,
            [
                fileId,
                name,
                restaurant_id,
                createdAt,
                JSON.stringify(formattedEmployees)
            ],
            function (err) {
                if (err) {
                    reject(err);
                    return;
                }

                resolve({
                    id: fileId,
                    name,
                    restaurant_id,
                    createdAt,
                    employees: formattedEmployees
                });
            }
        );
    });
}

module.exports = {
    db,
    createSalaryFile
};
