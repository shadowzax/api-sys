const express = require("express");
const bcrypt = require("bcrypt");
const router = express.Router();
const { db, generateId } = require("../../mydb/users");

const defaultProfilePicture = "https://i.ibb.co/HRbkkLw/3177440-1.jpg";

const permissionFields = [
    "dashboard_view",
    "outgoing_manage",
    "visa_manage",
    "transfers_manage",
    "advances_manage",
    "payments_manage",
    "accounts_manage",
    "logs_view",
    "settings_manage",
    "print_reports"
];

function normalizePermission(value) {
    return Number(value) === 1 ? 1 : 0;
}

router.post("/account", async (req, res) => {
    const {
        name,
        email,
        phone_number,
        profile_picture,
        password,
        account_type,
        job_title,
        account_status,
        advances,
        expenses,
        transfers,
        fees
    } = req.body;

    if (!name || !email || !phone_number || !password) {
        return res.status(400).json({
            success: false,
            message: "name, email, phone_number and password are required"
        });
    }

    const cleanName = String(name).trim();
    const cleanEmail = String(email).trim().toLowerCase();
    const cleanPhoneNumber = String(phone_number).trim();
    const cleanJobTitle = job_title ? String(job_title).trim() : "";
    const cleanPassword = String(password);

    if (!cleanName) {
        return res.status(400).json({
            success: false,
            message: "Name is required"
        });
    }

    if (!cleanEmail) {
        return res.status(400).json({
            success: false,
            message: "Email is required"
        });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(cleanEmail)) {
        return res.status(400).json({
            success: false,
            message: "Invalid email address"
        });
    }

    if (!cleanPhoneNumber) {
        return res.status(400).json({
            success: false,
            message: "Phone number is required"
        });
    }

    if (!cleanPassword) {
        return res.status(400).json({
            success: false,
            message: "Password is required"
        });
    }

    const finalAccountType = account_type
        ? String(account_type).trim()
        : "user";

    const finalAccountStatus = account_status
        ? String(account_status).trim()
        : "active";

    const finalProfilePicture = profile_picture
        ? String(profile_picture).trim()
        : defaultProfilePicture;

    const permissionValues = permissionFields.map(field =>
        normalizePermission(req.body[field])
    );

    const advancesValue = advances ?? [];
    const expensesValue = expenses ?? [];
    const transfersValue = transfers ?? [];
    const feesValue = fees ?? [];

    if (!Array.isArray(advancesValue)) {
        return res.status(400).json({
            success: false,
            message: "advances must be an array"
        });
    }

    if (!Array.isArray(expensesValue)) {
        return res.status(400).json({
            success: false,
            message: "expenses must be an array"
        });
    }

    if (!Array.isArray(transfersValue)) {
        return res.status(400).json({
            success: false,
            message: "transfers must be an array"
        });
    }

    if (!Array.isArray(feesValue)) {
        return res.status(400).json({
            success: false,
            message: "fees must be an array"
        });
    }

    try {
        const hashedPassword = await bcrypt.hash(cleanPassword, 10);

        const id = generateId();

        const sql = `
            INSERT INTO users (
                id,
                name,
                email,
                phone_number,
                profile_picture,
                password,
                account_type,
                job_title,
                account_status,
                advances,
                expenses,
                transfers,
                fees,
                dashboard_view,
                outgoing_manage,
                visa_manage,
                transfers_manage,
                advances_manage,
                payments_manage,
                accounts_manage,
                logs_view,
                settings_manage,
                print_reports
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        const values = [
            id,
            cleanName,
            cleanEmail,
            cleanPhoneNumber,
            finalProfilePicture,
            hashedPassword,
            finalAccountType,
            cleanJobTitle,
            finalAccountStatus,
            JSON.stringify(advancesValue),
            JSON.stringify(expensesValue),
            JSON.stringify(transfersValue),
            JSON.stringify(feesValue),
            ...permissionValues
        ];

        db.run(sql, values, function (err) {
            if (err) {
                if (err.message.includes("UNIQUE constraint failed: users.email")) {
                    return res.status(409).json({
                        success: false,
                        message: "Email already exists"
                    });
                }

                if (err.message.includes("UNIQUE constraint failed: users.phone_number")) {
                    return res.status(409).json({
                        success: false,
                        message: "Phone number already exists"
                    });
                }

                return res.status(500).json({
                    success: false,
                    message: err.message
                });
            }

            db.get(
                "SELECT * FROM users WHERE id = ?",
                [id],
                (selectErr, user) => {
                    if (selectErr) {
                        return res.status(500).json({
                            success: false,
                            message: selectErr.message
                        });
                    }

                    if (!user) {
                        return res.status(404).json({
                            success: false,
                            message: "Account was created but could not be retrieved"
                        });
                    }

                    try {
                        user.advances = JSON.parse(user.advances || "[]");
                        user.expenses = JSON.parse(user.expenses || "[]");
                        user.transfers = JSON.parse(user.transfers || "[]");
                        user.fees = JSON.parse(user.fees || "[]");
                    } catch (parseError) {
                        return res.status(500).json({
                            success: false,
                            message: "Failed to parse account data"
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "Account created successfully",
                        user
                    });
                }
            );
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: "Failed to hash password"
        });
    }
});
router.get("/users", (req, res) => {
    const sql = `
        SELECT *
        FROM users
        ORDER BY rowid DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        try {
            const users = rows.map(user => {
                user.advances = JSON.parse(user.advances || "[]");
                user.expenses = JSON.parse(user.expenses || "[]");
                user.transfers = JSON.parse(user.transfers || "[]");
                user.fees = JSON.parse(user.fees || "[]");

                return user;
            });

            return res.status(200).json({
                success: true,
                count: users.length,
                users
            });
        } catch (parseError) {
            return res.status(500).json({
                success: false,
                message: "Failed to parse account data"
            });
        }
    });
});
router.get("/reports", (req, res) => {
    const restaurantId = String(req.query.restaurant_id || "").trim();

    if (!restaurantId) {
        return res.status(400).json({
            success: false,
            message: "restaurant_id مطلوب"
        });
    }

    const sql = `
        SELECT id, name, profile_picture, advances, expenses, transfers, fees
        FROM users
        ORDER BY rowid DESC
    `;

    db.all(sql, [], (err, rows) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: err.message
            });
        }

        try {
            const reports = {
                advances: [],
                expenses: [],
                transfers: [],
                fees: []
            };

            rows.forEach(user => {
                let advances = [];
                let expenses = [];
                let transfers = [];
                let fees = [];

                try {
                    advances = JSON.parse(user.advances || "[]");
                } catch (error) {
                    advances = [];
                }

                try {
                    expenses = JSON.parse(user.expenses || "[]");
                } catch (error) {
                    expenses = [];
                }

                try {
                    transfers = JSON.parse(user.transfers || "[]");
                } catch (error) {
                    transfers = [];
                }

                try {
                    fees = JSON.parse(user.fees || "[]");
                } catch (error) {
                    fees = [];
                }

                if (Array.isArray(advances)) {
                    advances.forEach(report => {
                        if (
                            report &&
                            String(report.restaurant_id || "").trim() === restaurantId
                        ) {
                            reports.advances.push({
                                ...report,
                                created_by: {
                                    name: user.name || "",
                                    profile_picture: user.profile_picture || ""
                                }
                            });
                        }
                    });
                }

                if (Array.isArray(expenses)) {
                    expenses.forEach(report => {
                        if (
                            report &&
                            String(report.restaurant_id || "").trim() === restaurantId
                        ) {
                            reports.expenses.push({
                                ...report,
                                created_by: {
                                    name: user.name || "",
                                    profile_picture: user.profile_picture || ""
                                }
                            });
                        }
                    });
                }

                if (Array.isArray(transfers)) {
                    transfers.forEach(report => {
                        if (
                            report &&
                            String(report.restaurant_id || "").trim() === restaurantId
                        ) {
                            reports.transfers.push({
                                ...report,
                                created_by: {
                                    name: user.name || "",
                                    profile_picture: user.profile_picture || ""
                                }
                            });
                        }
                    });
                }

                if (Array.isArray(fees)) {
                    fees.forEach(report => {
                        if (
                            report &&
                            String(report.restaurant_id || "").trim() === restaurantId
                        ) {
                            reports.fees.push({
                                ...report,
                                created_by: {
                                    name: user.name || "",
                                    profile_picture: user.profile_picture || ""
                                }
                            });
                        }
                    });
                }
            });

            const total =
                reports.advances.length +
                reports.expenses.length +
                reports.transfers.length +
                reports.fees.length;

            return res.status(200).json({
                success: true,
                restaurant_id: restaurantId,
                count: total,
                reports
            });
        } catch (error) {
            return res.status(500).json({
                success: false,
                message: "حدث خطأ أثناء معالجة التقارير",
                error: error.message
            });
        }
    });
});
module.exports = router;
