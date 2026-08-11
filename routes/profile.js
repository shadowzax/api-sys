const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { db } = require("../mydb/users");

const JWT_SECRET = "secretkey";

router.get("/profile", (req, res) => {
    const token = req.cookies?.token;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "التوكين غير موجود"
        });
    }

    let decoded;

    try {
        decoded = jwt.verify(token, JWT_SECRET);
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "التوكين غير صالح أو منتهي الصلاحية"
        });
    }

    if (!decoded.id) {
        return res.status(401).json({
            success: false,
            message: "بيانات التوكين غير صحيحة"
        });
    }

    db.get(
        "SELECT * FROM users WHERE id = ? LIMIT 1",
        [decoded.id],
        (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ في قاعدة البيانات"
                });
            }

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "المستخدم غير موجود"
                });
            }

            return res.json({
                success: true,
                message: "تم جلب بيانات البروفايل بنجاح",
                user: user
            });
        }
    );
});

module.exports = router;