const express = require("express");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const router = express.Router();
const { db } = require("../mydb/users");

router.post("/login", (req, res) => {
    const JWT_SECRET = "secretkey";
    const { email, password } = req.body;

    if (!email || !password) {
        return res.status(400).json({
            success: false,
            message: "البريد الإلكتروني وكلمة المرور مطلوبان"
        });
    }

    db.get(
        "SELECT * FROM users WHERE email = ? LIMIT 1",
        [email],
        async (err, user) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ في قاعدة البيانات"
                });
            }

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
                });
            }

            try {
                const passwordMatch = await bcrypt.compare(
                    password,
                    user.password
                );

                if (!passwordMatch) {
                    return res.status(401).json({
                        success: false,
                        message: "البريد الإلكتروني أو كلمة المرور غير صحيحة"
                    });
                }

                const token = jwt.sign(
                    {
                        userId: user.id
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

                return res.json({
                    success: true,
                    message: "تم تسجيل الدخول بنجاح",
                    token,
                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        account_type: user.account_type
                    }
                });
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء تسجيل الدخول"
                });
            }
        }
    );
});

router.post("/check-token", (req, res) => {
    const JWT_SECRET = "secretkey";
    const { token } = req.body;

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

        db.get(
            "SELECT * FROM users WHERE id = ? LIMIT 1",
            [decoded.userId],
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

                user.is_admin = Boolean(user.is_admin);
                user.is_active = Boolean(user.is_active);

                return res.status(200).json({
                    success: true,
                    message: "التوكين صالح",
                    user
                });
            }
        );
    });
});

module.exports = router;