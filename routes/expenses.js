const express = require("express");
const router = express.Router();
const { db } = require("../mydb/users");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "secretkey";

router.post("/expenses-store", (req, res) => {
    const {
        token,
        restaurant_id = "",
        code = "",
        name = "",
        date = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات المصروفات غير صحيحة"
            });
        }

        const reportDate = String(date || "").trim();

        if (!reportDate) {
            return res.status(400).json({
                success: false,
                message: "التاريخ مطلوب"
            });
        }

        db.get(
            "SELECT account_type, expenses FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let expenses = [];

                try {
                    expenses = user.expenses
                        ? JSON.parse(user.expenses)
                        : [];

                    if (!Array.isArray(expenses)) {
                        expenses = [];
                    }
                } catch (error) {
                    expenses = [];
                }

                const existingReport = expenses.find((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return sameRestaurant && sameDate;
                });

                if (existingReport && user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "تحديث التقرير يحتاج إلى باسورد صحيح"
                        });
                    }
                }

                expenses = expenses.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return !(sameRestaurant && sameDate);
                });

                const report = {
                    id: existingReport
                        ? existingReport.id
                        : "rep_" +
                          Date.now() +
                          "_" +
                          Math.random()
                              .toString(36)
                              .substring(2, 8),

                    restaurant_id: restaurantId,

                    code: String(code || ""),

                    name: String(name || ""),

                    date: reportDate,

                    timestamp: new Date().toISOString(),

                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),

                    total: String(total || "0")
                };

                expenses.unshift(report);

                if (expenses.length > 20) {
                    expenses = expenses.slice(0, 20);
                }

                db.run(
                    "UPDATE users SET expenses = ? WHERE id = ?",
                    [
                        JSON.stringify(expenses),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تخزين المصروفات"
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: existingReport
                                ? "تم تحديث التقرير بنجاح"
                                : "تم حفظ التقرير بنجاح",
                            report
                        });
                    }
                );
            }
        );
    });
});
router.delete("/expenses-delete", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    if (password !== "01025") {
        return res.status(401).json({
            success: false,
            message: "الباسورد غير صحيح"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        db.get(
            "SELECT expenses FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let expenses = [];

                try {
                    expenses = user.expenses
                        ? JSON.parse(user.expenses)
                        : [];

                    if (!Array.isArray(expenses)) {
                        expenses = [];
                    }
                } catch (error) {
                    expenses = [];
                }

                const oldLength = expenses.length;

                expenses = expenses.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return !(sameId && sameRestaurant);
                });

                if (expenses.length === oldLength) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                db.run(
                    "UPDATE users SET expenses = ? WHERE id = ?",
                    [
                        JSON.stringify(expenses),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء حذف التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم حذف التقرير بنجاح",
                            reportId: reportIdValue
                        });
                    }
                );
            }
        );
    });
});

router.put("/expenses-update", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        code = "",
        name = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات المصروفات غير صحيحة"
            });
        }

        db.get(
            "SELECT account_type, expenses FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تعديل التقرير بدون باسورد صحيح"
                        });
                    }
                }

                let expenses = [];

                try {
                    expenses = user.expenses
                        ? JSON.parse(user.expenses)
                        : [];

                    if (!Array.isArray(expenses)) {
                        expenses = [];
                    }
                } catch (error) {
                    expenses = [];
                }

                const reportIndex = expenses.findIndex((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return sameId && sameRestaurant;
                });

                if (reportIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                const oldReport = expenses[reportIndex];

                const updatedReport = {
                    id: reportIdValue,
                    restaurant_id: restaurantId,
                    code: String(code || ""),
                    name: String(name || ""),
                    date: oldReport.date,
                    timestamp: new Date().toISOString(),
                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),
                    total: String(total || "0")
                };

                expenses[reportIndex] = updatedReport;

                db.run(
                    "UPDATE users SET expenses = ? WHERE id = ?",
                    [
                        JSON.stringify(expenses),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تعديل التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم تعديل التقرير بنجاح",
                            report: updatedReport
                        });
                    }
                );
            }
        );
    });
});
/*----------------------------------------------------------*/
router.post("/advances-store", (req, res) => {
    const {
        token,
        restaurant_id = "",
        code = "",
        name = "",
        date = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات السلف غير صحيحة"
            });
        }

        const reportDate = String(date || "").trim();

        if (!reportDate) {
            return res.status(400).json({
                success: false,
                message: "التاريخ مطلوب"
            });
        }

        db.get(
            "SELECT account_type, advances FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تخزين السلف بدون باسورد صحيح"
                        });
                    }
                }

                let advances = [];

                try {
                    advances = user.advances
                        ? JSON.parse(user.advances)
                        : [];

                    if (!Array.isArray(advances)) {
                        advances = [];
                    }
                } catch (error) {
                    advances = [];
                }

                advances = advances.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return !(sameRestaurant && sameDate);
                });

                const report = {
                    id:
                        "rep_" +
                        Date.now() +
                        "_" +
                        Math.random()
                            .toString(36)
                            .substring(2, 8),

                    restaurant_id: restaurantId,

                    code: String(code || ""),

                    name: String(name || ""),

                    date: reportDate,

                    timestamp: new Date().toISOString(),

                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),

                    total: String(total || "0")
                };

                advances.unshift(report);

                if (advances.length > 20) {
                    advances = advances.slice(0, 20);
                }

                db.run(
                    "UPDATE users SET advances = ? WHERE id = ?",
                    [
                        JSON.stringify(advances),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تخزين السلف"
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "تم تحديث السلف بنجاح",
                            report
                        });
                    }
                );
            }
        );
    });
});


router.delete("/advances-delete", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    if (password !== "01025") {
        return res.status(401).json({
            success: false,
            message: "الباسورد غير صحيح"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        db.get(
            "SELECT advances FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let advances = [];

                try {
                    advances = user.advances
                        ? JSON.parse(user.advances)
                        : [];

                    if (!Array.isArray(advances)) {
                        advances = [];
                    }
                } catch (error) {
                    advances = [];
                }

                const oldLength = advances.length;

                advances = advances.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return !(sameId && sameRestaurant);
                });

                if (advances.length === oldLength) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                db.run(
                    "UPDATE users SET advances = ? WHERE id = ?",
                    [
                        JSON.stringify(advances),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء حذف التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم حذف التقرير بنجاح",
                            reportId: reportIdValue
                        });
                    }
                );
            }
        );
    });
});

router.put("/advances-update", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        code = "",
        name = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات السلف غير صحيحة"
            });
        }

        db.get(
            "SELECT account_type, advances FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تعديل التقرير بدون باسورد صحيح"
                        });
                    }
                }

                let advances = [];

                try {
                    advances = user.advances
                        ? JSON.parse(user.advances)
                        : [];

                    if (!Array.isArray(advances)) {
                        advances = [];
                    }
                } catch (error) {
                    advances = [];
                }

                const reportIndex = advances.findIndex((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return sameId && sameRestaurant;
                });

                if (reportIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                const oldReport = advances[reportIndex];

                const updatedReport = {
                    id: reportIdValue,
                    restaurant_id: restaurantId,
                    code: String(code || ""),
                    name: String(name || ""),
                    date: oldReport.date,
                    timestamp: new Date().toISOString(),
                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),
                    total: String(total || "0")
                };

                advances[reportIndex] = updatedReport;

                db.run(
                    "UPDATE users SET advances = ? WHERE id = ?",
                    [
                        JSON.stringify(advances),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تعديل التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم تعديل التقرير بنجاح",
                            report: updatedReport
                        });
                    }
                );
            }
        );
    });
});
/*--------------------------------------------------------*/
router.post("/trans-store", (req, res) => {
    const {
        token,
        restaurant_id = "",
        code = "",
        name = "",
        date = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات التحويلات غير صحيحة"
            });
        }

        const reportDate = String(date || "").trim();

        if (!reportDate) {
            return res.status(400).json({
                success: false,
                message: "التاريخ مطلوب"
            });
        }

        db.get(
            "SELECT account_type, transfers FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تخزين التحويلات بدون باسورد صحيح"
                        });
                    }
                }

                let transfers = [];

                try {
                    transfers = user.transfers
                        ? JSON.parse(user.transfers)
                        : [];

                    if (!Array.isArray(transfers)) {
                        transfers = [];
                    }
                } catch (error) {
                    transfers = [];
                }

                transfers = transfers.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return !(sameRestaurant && sameDate);
                });

                const report = {
                    id:
                        "rep_" +
                        Date.now() +
                        "_" +
                        Math.random()
                            .toString(36)
                            .substring(2, 8),

                    restaurant_id: restaurantId,

                    code: String(code || ""),

                    name: String(name || ""),

                    date: reportDate,

                    timestamp: new Date().toISOString(),

                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),

                    total: String(total || "0")
                };

                transfers.unshift(report);

                if (transfers.length > 20) {
                    transfers = transfers.slice(0, 20);
                }

                db.run(
                    "UPDATE users SET transfers = ? WHERE id = ?",
                    [
                        JSON.stringify(transfers),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تخزين التحويلات"
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "تم تحديث التحويلات بنجاح",
                            report
                        });
                    }
                );
            }
        );
    });
});
router.delete("/trans-delete", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    if (password !== "01025") {
        return res.status(401).json({
            success: false,
            message: "الباسورد غير صحيح"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        db.get(
            "SELECT transfers FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let transfers = [];

                try {
                    transfers = user.transfers
                        ? JSON.parse(user.transfers)
                        : [];

                    if (!Array.isArray(transfers)) {
                        transfers = [];
                    }
                } catch (error) {
                    transfers = [];
                }

                const oldLength = transfers.length;

                transfers = transfers.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return !(sameId && sameRestaurant);
                });

                if (transfers.length === oldLength) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                db.run(
                    "UPDATE users SET transfers = ? WHERE id = ?",
                    [
                        JSON.stringify(transfers),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء حذف التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم حذف التقرير بنجاح",
                            reportId: reportIdValue
                        });
                    }
                );
            }
        );
    });
});
router.put("/trans-update", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        code = "",
        name = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات التحويلات غير صحيحة"
            });
        }

        db.get(
            "SELECT account_type, transfers FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تعديل التقرير بدون باسورد صحيح"
                        });
                    }
                }

                let transfers = [];

                try {
                    transfers = user.transfers
                        ? JSON.parse(user.transfers)
                        : [];

                    if (!Array.isArray(transfers)) {
                        transfers = [];
                    }
                } catch (error) {
                    transfers = [];
                }

                const reportIndex = transfers.findIndex((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return sameId && sameRestaurant;
                });

                if (reportIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                const oldReport = transfers[reportIndex];

                const updatedReport = {
                    id: reportIdValue,
                    restaurant_id: restaurantId,
                    code: String(code || ""),
                    name: String(name || ""),
                    date: oldReport.date,
                    timestamp: new Date().toISOString(),
                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),
                    total: String(total || "0")
                };

                transfers[reportIndex] = updatedReport;

                db.run(
                    "UPDATE users SET transfers = ? WHERE id = ?",
                    [
                        JSON.stringify(transfers),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تعديل التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم تعديل التقرير بنجاح",
                            report: updatedReport
                        });
                    }
                );
            }
        );
    });
});
/*----------------------------------------------*/
router.post("/fees-store", (req, res) => {
    const {
        token,
        restaurant_id = "",
        code = "",
        name = "",
        date = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات الرسوم غير صحيحة"
            });
        }

        const reportDate = String(date || "").trim();

        if (!reportDate) {
            return res.status(400).json({
                success: false,
                message: "التاريخ مطلوب"
            });
        }

        db.get(
            "SELECT account_type, fees FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let fees = [];

                try {
                    fees = user.fees
                        ? JSON.parse(user.fees)
                        : [];

                    if (!Array.isArray(fees)) {
                        fees = [];
                    }
                } catch (error) {
                    fees = [];
                }

                const existingReport = fees.find((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return sameRestaurant && sameDate;
                });

                if (existingReport && user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "تحديث التقرير يحتاج إلى باسورد صحيح"
                        });
                    }
                }

                fees = fees.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    const sameDate =
                        String(report.date || "").trim() === reportDate;

                    return !(sameRestaurant && sameDate);
                });

                const report = {
                    id: existingReport
                        ? existingReport.id
                        : "rep_" +
                          Date.now() +
                          "_" +
                          Math.random()
                              .toString(36)
                              .substring(2, 8),

                    restaurant_id: restaurantId,

                    code: String(code || ""),

                    name: String(name || ""),

                    date: reportDate,

                    timestamp: new Date().toISOString(),

                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),

                    total: String(total || "0")
                };

                fees.unshift(report);

                if (fees.length > 20) {
                    fees = fees.slice(0, 20);
                }

                db.run(
                    "UPDATE users SET fees = ? WHERE id = ?",
                    [
                        JSON.stringify(fees),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تخزين الرسوم"
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: existingReport
                                ? "تم تحديث التقرير بنجاح"
                                : "تم حفظ التقرير بنجاح",
                            report
                        });
                    }
                );
            }
        );
    });
});
router.delete("/fees-delete", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    if (password !== "01025") {
        return res.status(401).json({
            success: false,
            message: "الباسورد غير صحيح"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        db.get(
            "SELECT fees FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                let fees = [];

                try {
                    fees = user.fees
                        ? JSON.parse(user.fees)
                        : [];

                    if (!Array.isArray(fees)) {
                        fees = [];
                    }
                } catch (error) {
                    fees = [];
                }

                const oldLength = fees.length;

                fees = fees.filter((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return !(sameId && sameRestaurant);
                });

                if (fees.length === oldLength) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                db.run(
                    "UPDATE users SET fees = ? WHERE id = ?",
                    [
                        JSON.stringify(fees),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء حذف التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم حذف التقرير بنجاح",
                            reportId: reportIdValue
                        });
                    }
                );
            }
        );
    });
});

router.put("/fees-update", (req, res) => {
    const {
        token,
        restaurant_id = "",
        reportId = "",
        code = "",
        name = "",
        rows = [],
        total = "0",
        password = ""
    } = req.body;

    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        const restaurantId = String(restaurant_id || "").trim();

        if (!restaurantId) {
            return res.status(400).json({
                success: false,
                message: "ايدي المطعم مطلوب"
            });
        }

        const reportIdValue = String(reportId || "").trim();

        if (!reportIdValue) {
            return res.status(400).json({
                success: false,
                message: "ايدي التقرير مطلوب"
            });
        }

        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات الرسوم غير صحيحة"
            });
        }

        db.get(
            "SELECT account_type, fees FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب بيانات المستخدم"
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    const enteredPassword = String(password || "").trim();

                    if (
                        enteredPassword !== "01025" &&
                        enteredPassword !== "01063"
                    ) {
                        return res.status(403).json({
                            success: false,
                            message: "ليس لديك صلاحية تعديل التقرير بدون باسورد صحيح"
                        });
                    }
                }

                let fees = [];

                try {
                    fees = user.fees
                        ? JSON.parse(user.fees)
                        : [];

                    if (!Array.isArray(fees)) {
                        fees = [];
                    }
                } catch (error) {
                    fees = [];
                }

                const reportIndex = fees.findIndex((report) => {
                    if (!report) {
                        return false;
                    }

                    const sameId =
                        String(report.id || "").trim() === reportIdValue;

                    const sameRestaurant =
                        String(report.restaurant_id || "").trim() === restaurantId;

                    return sameId && sameRestaurant;
                });

                if (reportIndex === -1) {
                    return res.status(404).json({
                        success: false,
                        message: "التقرير غير موجود"
                    });
                }

                const oldReport = fees[reportIndex];

                const updatedReport = {
                    id: reportIdValue,
                    restaurant_id: restaurantId,
                    code: String(code || ""),
                    name: String(name || ""),
                    date: oldReport.date,
                    timestamp: new Date().toISOString(),
                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),
                    total: String(total || "0")
                };

                fees[reportIndex] = updatedReport;

                db.run(
                    "UPDATE users SET fees = ? WHERE id = ?",
                    [
                        JSON.stringify(fees),
                        userId
                    ],
                    (updateErr) => {
                        if (updateErr) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تعديل التقرير"
                            });
                        }

                        return res.status(200).json({
                            success: true,
                            message: "تم تعديل التقرير بنجاح",
                            report: updatedReport
                        });
                    }
                );
            }
        );
    });
});
module.exports = router;
