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

function generateFileId() {
    return `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
}

function generateEmployeeId() {
    return String(Math.floor(100 + Math.random() * 900));
}

function generateUniqueEmployeeId(usedIds) {
    let id;

    do {
        id = generateEmployeeId();
    } while (usedIds.has(id));

    usedIds.add(id);

    return id;
}

function generateEmployeeCode(usedCodes) {
    let code;

    do {
        code = String(Math.floor(100 + Math.random() * 900));
    } while (usedCodes.has(code));

    usedCodes.add(code);

    return code;
}

function normalizeEmployees(employees) {
    if (!Array.isArray(employees)) {
        return [];
    }

    const usedIds = new Set();
    const usedCodes = new Set();

    return employees.map((employee) => {
        const updatedEmployee = {
            ...employee
        };

        let employeeId = String(updatedEmployee.id || "").trim();
        let employeeCode = String(updatedEmployee.code || "").trim();

        if (!employeeId || usedIds.has(employeeId)) {
            employeeId = generateUniqueEmployeeId(usedIds);
        } else {
            usedIds.add(employeeId);
        }

        if (!employeeCode || usedCodes.has(employeeCode)) {
            employeeCode = generateEmployeeCode(usedCodes);
        } else {
            usedCodes.add(employeeCode);
        }

        updatedEmployee.id = employeeId;
        updatedEmployee.code = employeeCode;

        updatedEmployee.name =
            updatedEmployee.name === undefined ||
            updatedEmployee.name === null
                ? ""
                : String(updatedEmployee.name);

        updatedEmployee.phone =
            updatedEmployee.phone === undefined ||
            updatedEmployee.phone === null
                ? ""
                : String(updatedEmployee.phone);

        updatedEmployee.profession =
            updatedEmployee.profession === undefined ||
            updatedEmployee.profession === null
                ? ""
                : String(updatedEmployee.profession);

        updatedEmployee.monthlySalary =
            updatedEmployee.monthlySalary === undefined ||
            updatedEmployee.monthlySalary === null ||
            updatedEmployee.monthlySalary === ""
                ? "0"
                : String(updatedEmployee.monthlySalary);

        if (!Array.isArray(updatedEmployee.salaryRecords)) {
            updatedEmployee.salaryRecords = [];
        }

        if (!Array.isArray(updatedEmployee.advances)) {
            updatedEmployee.advances = [];
        }

        return updatedEmployee;
    });
}

function updateOldEmployees() {
    db.all(
        "SELECT id, employees FROM salary_files",
        (err, rows) => {
            if (err) {
                console.error(err.message);
                return;
            }

            if (!Array.isArray(rows)) {
                return;
            }

            rows.forEach((row) => {
                let employees;

                try {
                    employees = JSON.parse(row.employees || "[]");
                } catch (error) {
                    console.error(
                        `تعذر قراءة موظفي الملف ${row.id}:`,
                        error.message
                    );
                    return;
                }

                if (!Array.isArray(employees)) {
                    return;
                }

                const hasInvalidData = employees.some((employee) => {
                    return (
                        !employee ||
                        !employee.id ||
                        !employee.code ||
                        !Array.isArray(employee.salaryRecords) ||
                        !Array.isArray(employee.advances)
                    );
                });

                if (!hasInvalidData) {
                    return;
                }

                const updatedEmployees = normalizeEmployees(employees);

                db.run(
                    `
                    UPDATE salary_files
                    SET employees = ?
                    WHERE id = ?
                    `,
                    [
                        JSON.stringify(updatedEmployees),
                        row.id
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            console.error(updateErr.message);
                        }
                    }
                );
            });
        }
    );
}

db.serialize(() => {
    db.run(`
        CREATE TABLE IF NOT EXISTS salary_files (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            restaurant_id TEXT,
            created_at TEXT NOT NULL,
            employees TEXT NOT NULL DEFAULT '[]'
        )
    `, (err) => {
        if (err) {
            console.error(err.message);
            return;
        }

        db.all(
            "PRAGMA table_info(salary_files)",
            (err, columns) => {
                if (err) {
                    console.error(err.message);
                    return;
                }

                const hasRestaurantId = columns.some(
                    column => column.name === "restaurant_id"
                );

                const continueSetup = () => {
                    db.run(
                        `
                        UPDATE salary_files
                        SET restaurant_id = '1'
                        WHERE restaurant_id IS NULL OR restaurant_id = ''
                        `,
                        (err) => {
                            if (err) {
                                console.error(err.message);
                                return;
                            }

                            updateOldEmployees();
                        }
                    );
                };

                if (!hasRestaurantId) {
                    db.run(
                        `
                        ALTER TABLE salary_files
                        ADD COLUMN restaurant_id TEXT
                        `,
                        (err) => {
                            if (err) {
                                console.error(err.message);
                                return;
                            }

                            continueSetup();
                        }
                    );
                } else {
                    continueSetup();
                }
            }
        );
    });
});

function createSalaryFile(name, restaurant_id, employees = []) {
    return new Promise((resolve, reject) => {
        const cleanName = String(name || "").trim();
        const cleanRestaurantId = String(restaurant_id || "").trim();

        if (!cleanName) {
            reject(new Error("اسم الملف مطلوب"));
            return;
        }

        if (!cleanRestaurantId) {
            reject(new Error("restaurant_id مطلوب"));
            return;
        }

        if (!Array.isArray(employees)) {
            reject(new Error("employees يجب أن تكون مصفوفة"));
            return;
        }

        const fileId = generateFileId();
        const createdAt = new Date().toISOString();

        const usedIds = new Set();
        const usedCodes = new Set();

        const formattedEmployees = employees.map((employee) => {
            const employeeId = generateUniqueEmployeeId(usedIds);
            const employeeCode = generateEmployeeCode(usedCodes);

            return {
                id: employeeId,
                code: employeeCode,
                name:
                    employee.name === undefined ||
                    employee.name === null
                        ? ""
                        : String(employee.name).trim(),
                phone:
                    employee.phone === undefined ||
                    employee.phone === null
                        ? ""
                        : String(employee.phone).trim(),
                profession:
                    employee.profession === undefined ||
                    employee.profession === null
                        ? ""
                        : String(employee.profession).trim(),
                monthlySalary:
                    employee.monthlySalary === undefined ||
                    employee.monthlySalary === null ||
                    employee.monthlySalary === ""
                        ? "0"
                        : String(employee.monthlySalary),
                salaryRecords: Array.isArray(employee.salaryRecords)
                    ? employee.salaryRecords
                    : [],
                advances: Array.isArray(employee.advances)
                    ? employee.advances
                    : []
            };
        });

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
                cleanName,
                cleanRestaurantId,
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
                    name: cleanName,
                    restaurant_id: cleanRestaurantId,
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
