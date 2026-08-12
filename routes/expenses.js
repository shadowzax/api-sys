const express = require("express");
const router = express.Router();
const { db } = require("../mydb/users");
const jwt = require("jsonwebtoken");

const JWT_SECRET = "secretkey";
router.post("/store", (req, res) => {
    const {
        token,
        name = "",
        date = "",
        rows = [],
        total = "0"
    } = req.body;

    // التحقق من وجود التوكين
    if (!token) {
        return res.status(400).json({
            success: false,
            message: "التوكين مطلوب"
        });
    }

    // التحقق من التوكين
    jwt.verify(token, JWT_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).json({
                success: false,
                message: "التوكين غير صالح أو منتهي الصلاحية"
            });
        }

        // نفس طريقة /check-token
        const userId = decoded.userId;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات المستخدم غير موجودة داخل التوكين"
            });
        }

        // التحقق من rows
        if (!Array.isArray(rows)) {
            return res.status(400).json({
                success: false,
                message: "بيانات التقرير غير صحيحة"
            });
        }

        // جلب المستخدم عن طريق userId
        db.get(
            "SELECT * FROM users WHERE id = ? LIMIT 1",
            [userId],
            (err, user) => {
                if (err) {
                    console.error("Database Error:", err);

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

                // قراءة التقارير القديمة
                let expenses = [];

                try {
                    expenses = user.expenses
                        ? JSON.parse(user.expenses)
                        : [];

                    if (!Array.isArray(expenses)) {
                        expenses = [];
                    }
                } catch (parseError) {
                    console.error("Expenses JSON Error:", parseError);
                    expenses = [];
                }

                // إنشاء التقرير
                const report = {
                    id:
                        "rep_" +
                        Date.now() +
                        "_" +
                        Math.random()
                            .toString(36)
                            .substring(2, 8),

                    name: String(name || ""),

                    date: String(date || ""),

                    timestamp: new Date().toISOString(),

                    rows: rows.map((row) => ({
                        desc: String(row?.desc || ""),
                        amount: String(row?.amount || "0")
                    })),

                    total: String(total || "0")
                };

                // إضافة التقرير في البداية
                expenses.unshift(report);

                // الاحتفاظ بآخر 20 تقرير فقط
                if (expenses.length > 20) {
                    expenses = expenses.slice(0, 20);
                }

                // تحديث قاعدة البيانات
                db.run(
                    "UPDATE users SET expenses = ? WHERE id = ?",
                    [
                        JSON.stringify(expenses),
                        userId
                    ],
                    function (updateErr) {
                        if (updateErr) {
                            console.error(
                                "Update Expenses Error:",
                                updateErr
                            );

                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء تخزين التقرير"
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "تم تخزين التقرير بنجاح",
                            report
                        });
                    }
                );
            }
        );
    });
});


module.exports = router;
