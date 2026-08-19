const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { db: userDb } = require("../../mydb/users");
const { db, createSalaryFile } = require("../../mydb/salary");

const JWT_SECRET = "secretkey";

router.post("/delete-folder", (req, res) => {
    try {
        const { folderId, password } = req.body;

        if (!password || (password !== "01025" && password !== "01063")) {
            return res.status(401).json({
                success: false,
                message: "الباسورد غير صحيح"
            });
        }

        if (!folderId || typeof folderId !== "string" || !folderId.trim()) {
            return res.status(400).json({
                success: false,
                message: "معرف الفايل مطلوب"
            });
        }

        const id = folderId.trim();

        db.run("DELETE FROM salary_files WHERE id = ?", [id], function (error) {
            if (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء حذف الفايل",
                    error: error.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    message: "الفايل غير موجود"
                });
            }

            return res.status(200).json({
                success: true,
                message: "تم حذف الفايل بنجاح",
                fileId: id
            });
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء حذف الفايل",
            error: error.message
        });
    }
});

router.post("/copy", (req, res) => {
    try {
        const { fileId = "", name = "", restaurant_id, password = "" } = req.body;

        if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
            return res.status(400).json({
                success: false,
                message: "معرف الملف مطلوب"
            });
        }

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "اسم الملف الجديد مطلوب"
            });
        }

        if (!restaurant_id) {
            return res.status(400).json({
                success: false,
                message: "restaurant_id مطلوب"
            });
        }

        if (password !== "01063" && password !== "01025") {
            return res.status(403).json({
                success: false,
                message: "كلمة المرور غير صحيحة"
            });
        }

        db.get(
            "SELECT id, name, restaurant_id, created_at, employees FROM salary_files WHERE id = ?",
            [fileId.trim()],
            (err, file) => {
                if (err) {
                    console.error(err);
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء جلب الملف",
                        error: err.message
                    });
                }

                if (!file) {
                    return res.status(404).json({
                        success: false,
                        message: "الملف غير موجود"
                    });
                }

                let employees;
                try {
                    employees = JSON.parse(file.employees || "[]");
                } catch (error) {
                    return res.status(500).json({
                        success: false,
                        message: "بيانات الموظفين غير صالحة",
                        error: error.message
                    });
                }

                if (!Array.isArray(employees)) {
                    return res.status(500).json({
                        success: false,
                        message: "بيانات الموظفين غير صالحة"
                    });
                }

                const copiedEmployees = employees.map(employee => ({
                    id: `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`,
                    code: employee.code || "",
                    name: employee.name || "",
                    profession: employee.profession || "",
                    monthlySalary: employee.monthlySalary || "0",
                    salaryRecords: [],
                    advances: []
                }));

                const newFileId = `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
                const createdAt = new Date().toISOString();

                db.run(
                    "INSERT INTO salary_files (id, name, restaurant_id, created_at, employees) VALUES (?, ?, ?, ?, ?)",
                    [newFileId, name.trim(), String(restaurant_id), createdAt, JSON.stringify(copiedEmployees)],
                    function (insertError) {
                        if (insertError) {
                            console.error(insertError);
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء نسخ الملف",
                                error: insertError.message
                            });
                        }

                        return res.status(201).json({
                            success: true,
                            message: "تم نسخ الملف بنجاح",
                            file: {
                                id: newFileId,
                                name: name.trim(),
                                restaurant_id: String(restaurant_id),
                                createdAt,
                                employees: copiedEmployees
                            }
                        });
                    }
                );
            }
        );
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء نسخ الملف",
            error: error.message
        });
    }
});

router.post("/create", async (req, res) => {
    try {
        const { name = "", restaurant_id, employees = [] } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "اسم الملف مطلوب"
            });
        }

        if (!restaurant_id) {
            return res.status(400).json({
                success: false,
                message: "restaurant_id مطلوب"
            });
        }

        if (!Array.isArray(employees)) {
            return res.status(400).json({
                success: false,
                message: "employees يجب أن تكون مصفوفة"
            });
        }

        const formattedEmployees = employees.map((employee, index) => {
            if (!employee || typeof employee !== "object") {
                return {
                    code: String(index + 1).padStart(3, "0"),
                    name: "",
                    profession: "",
                    monthlySalary: "0",
                    salaryRecords: [],
                    advances: []
                };
            }

            return {
                id: employee.id,
                code: employee.code || String(index + 1).padStart(3, "0"),
                name: employee.name || "",
                profession: employee.profession || "",
                monthlySalary: employee.monthlySalary || "0",
                salaryRecords: Array.isArray(employee.salaryRecords) ? employee.salaryRecords : [],
                advances: Array.isArray(employee.advances) ? employee.advances : []
            };
        });

        const file = await createSalaryFile(name.trim(), restaurant_id, formattedEmployees);

        return res.status(201).json({
            success: true,
            message: "تم إنشاء الملف بنجاح",
            file
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء إنشاء الملف",
            error: error.message
        });
    }
});

router.post("/add-employee", (req, res) => {
    const {
        fileId = "",
        name = "",
        phone = "",
        profession = "",
        monthlySalary = ""
    } = req.body;

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
        return res.status(400).json({
            success: false,
            message: "معرف الملف مطلوب"
        });
    }

    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: "اسم الموظف مطلوب"
        });
    }

    if (!profession || typeof profession !== "string" || !profession.trim()) {
        return res.status(400).json({
            success: false,
            message: "المهنة مطلوبة"
        });
    }

    if (
        monthlySalary === undefined ||
        monthlySalary === null ||
        monthlySalary === "" ||
        !Number.isFinite(Number(monthlySalary)) ||
        Number(monthlySalary) < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "الراتب غير صحيح"
        });
    }

    const employeePhone =
        phone === undefined || phone === null
            ? ""
            : String(phone).trim();

    db.get(
        "SELECT id, name, created_at, employees FROM salary_files WHERE id = ?",
        [fileId.trim()],
        (err, file) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء جلب الملف",
                    error: err.message
                });
            }

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: "الملف غير موجود"
                });
            }

            let employees;

            try {
                employees = JSON.parse(file.employees || "[]");
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة",
                    error: error.message
                });
            }

            if (!Array.isArray(employees)) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة"
                });
            }

            let employeeId;

            do {
                employeeId = String(Math.floor(100 + Math.random() * 900));
            } while (employees.some(employee => String(employee.id) === employeeId));

            const nextCode = String(
                employees.reduce((max, employee) => {
                    const code = Number(employee.code);
                    return Number.isFinite(code) && code > max ? code : max;
                }, 0) + 1
            ).padStart(3, "0");

            const employee = {
                id: employeeId,
                code: nextCode,
                name: name.trim(),
                phone: employeePhone,
                profession: profession.trim(),
                monthlySalary: String(monthlySalary),
                salaryRecords: [],
                advances: []
            };

            employees.push(employee);

            db.run(
                "UPDATE salary_files SET employees = ? WHERE id = ?",
                [JSON.stringify(employees), fileId.trim()],
                updateError => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "حدث خطأ أثناء إضافة الموظف",
                            error: updateError.message
                        });
                    }

                    return res.status(201).json({
                        success: true,
                        message: "تم إضافة الموظف بنجاح",
                        employee,
                        file: {
                            id: file.id,
                            name: file.name,
                            createdAt: file.created_at,
                            employees
                        }
                    });
                }
            );
        }
    );
});
router.put("/update-employee", (req, res) => {
    const {
        fileId = "",
        employeeId = "",
        code = "",
        name = "",
        phone = "",
        profession = "",
        monthlySalary = ""
    } = req.body;

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
        return res.status(400).json({
            success: false,
            message: "معرف الملف مطلوب"
        });
    }

    if (!employeeId || typeof employeeId !== "string" || !employeeId.trim()) {
        return res.status(400).json({
            success: false,
            message: "معرف الموظف مطلوب"
        });
    }

    if (code === undefined || code === null || String(code).trim() === "") {
        return res.status(400).json({
            success: false,
            message: "كود الموظف مطلوب"
        });
    }

    const employeeCode = String(code).trim();

    if (!name || typeof name !== "string" || !name.trim()) {
        return res.status(400).json({
            success: false,
            message: "اسم الموظف مطلوب"
        });
    }

    if (!profession || typeof profession !== "string" || !profession.trim()) {
        return res.status(400).json({
            success: false,
            message: "المهنة مطلوبة"
        });
    }

    if (
        monthlySalary === undefined ||
        monthlySalary === null ||
        monthlySalary === "" ||
        !Number.isFinite(Number(monthlySalary)) ||
        Number(monthlySalary) < 0
    ) {
        return res.status(400).json({
            success: false,
            message: "الراتب غير صحيح"
        });
    }

    const employeePhone =
        phone === undefined || phone === null
            ? ""
            : String(phone).trim();

    db.get(
        "SELECT id, name, created_at, employees FROM salary_files WHERE id = ?",
        [fileId.trim()],
        (err, file) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء جلب الملف",
                    error: err.message
                });
            }

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: "الملف غير موجود"
                });
            }

            let employees;

            try {
                employees = JSON.parse(file.employees || "[]");
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة",
                    error: error.message
                });
            }

            if (!Array.isArray(employees)) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة"
                });
            }

            const employeeIndex = employees.findIndex(
                employee => String(employee.id) === employeeId.trim()
            );

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            const duplicateCode = employees.some(
                (employee, index) =>
                    index !== employeeIndex &&
                    String(employee.code || "").trim() === employeeCode
            );

            if (duplicateCode) {
                return res.status(409).json({
                    success: false,
                    message: "كود الموظف مستخدم بالفعل"
                });
            }

            employees[employeeIndex] = {
                ...employees[employeeIndex],
                code: employeeCode,
                name: name.trim(),
                phone: employeePhone,
                profession: profession.trim(),
                monthlySalary: String(monthlySalary)
            };

            db.run(
                "UPDATE salary_files SET employees = ? WHERE id = ?",
                [JSON.stringify(employees), fileId.trim()],
                updateError => {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "حدث خطأ أثناء تعديل الموظف",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "تم تعديل الموظف بنجاح",
                        employee: employees[employeeIndex]
                    });
                }
            );
        }
    );
});
router.delete("/delete-employee", (req, res) => {
    const { fileId = "", employeeId = "", password = "" } = req.body;

    if (!fileId || typeof fileId !== "string" || !fileId.trim()) {
        return res.status(400).json({
            success: false,
            message: "معرف الملف مطلوب"
        });
    }

    if (!employeeId || typeof employeeId !== "string" || !employeeId.trim()) {
        return res.status(400).json({
            success: false,
            message: "معرف الموظف مطلوب"
        });
    }

    if (!password || typeof password !== "string" || !password.trim()) {
        return res.status(400).json({
            success: false,
            message: "كلمة المرور مطلوبة"
        });
    }

    if (password.trim() !== "01025" && password.trim() !== "01063") {
        return res.status(401).json({
            success: false,
            message: "كلمة المرور غير صحيحة"
        });
    }

    db.get(
        "SELECT id, name, restaurant_id, created_at, employees FROM salary_files WHERE id = ?",
        [fileId.trim()],
        (err, file) => {
            if (err) {
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء جلب الملف",
                    error: err.message
                });
            }

            if (!file) {
                return res.status(404).json({
                    success: false,
                    message: "الملف غير موجود"
                });
            }

            let employees;
            try {
                employees = JSON.parse(file.employees || "[]");
            } catch (error) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة",
                    error: error.message
                });
            }

            if (!Array.isArray(employees)) {
                return res.status(500).json({
                    success: false,
                    message: "بيانات الموظفين غير صالحة"
                });
            }

            const employeeIndex = employees.findIndex(employee => employee.id === employeeId.trim());

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            const deletedEmployee = employees.splice(employeeIndex, 1)[0];

            db.run(
                "UPDATE salary_files SET employees = ? WHERE id = ?",
                [JSON.stringify(employees), fileId.trim()],
                function (updateError) {
                    if (updateError) {
                        return res.status(500).json({
                            success: false,
                            message: "حدث خطأ أثناء حذف الموظف",
                            error: updateError.message
                        });
                    }

                    return res.status(200).json({
                        success: true,
                        message: "تم حذف الموظف بنجاح",
                        employee: deletedEmployee,
                        file: {
                            id: file.id,
                            name: file.name,
                            restaurant_id: file.restaurant_id || "1",
                            createdAt: file.created_at,
                            employees
                        }
                    });
                }
            );
        }
    );
});

router.get("/", (req, res) => {
    db.all(
        "SELECT id, name, restaurant_id, created_at, employees FROM salary_files ORDER BY created_at DESC",
        [],
        (err, rows) => {
            if (err) {
                console.error(err);
                return res.status(500).json({
                    success: false,
                    message: "حدث خطأ أثناء جلب الملفات",
                    error: err.message
                });
            }

            try {
                const files = rows.map(row => ({
                    id: row.id,
                    name: row.name,
                    restaurant_id: row.restaurant_id || "1",
                    createdAt: row.created_at,
                    employees: JSON.parse(row.employees || "[]")
                }));

                return res.status(200).json({
                    success: true,
                    count: files.length,
                    files
                });
            } catch (error) {
                console.error(error);
                return res.status(500).json({
                    success: false,
                    message: "خطأ في قراءة بيانات الملفات",
                    error: error.message
                });
            }
        }
    );
});

router.post("/advance", (req, res) => {
    const { token, fileId, employeeId, day, amount } = req.body;

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

        const userId = decoded.id || decoded.userId || decoded._id || decoded.user_id || decoded.sub;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات التوكين غير صحيحة"
            });
        }

        userDb.get(
            "SELECT id, account_type FROM users WHERE id = ? LIMIT 1",
            [userId],
            (userError, user) => {
                if (userError) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء التحقق من المستخدم",
                        error: userError.message
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "غير مسموح لك بتعديل السلف"
                    });
                }

                if (!fileId || !employeeId || day === undefined || day === null || day === "") {
                    return res.status(400).json({
                        success: false,
                        message: "fileId و employeeId و day مطلوبة"
                    });
                }

                const dayNumber = Number(day);

                if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
                    return res.status(400).json({
                        success: false,
                        message: "اليوم يجب أن يكون رقمًا من 1 إلى 31"
                    });
                }

                if (
                    amount === undefined ||
                    amount === null ||
                    amount === "" ||
                    !Number.isFinite(Number(amount)) ||
                    Number(amount) < 0
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "قيمة السلفة غير صحيحة"
                    });
                }

                const dayValue = String(dayNumber);
                const amountNumber = Number(amount);
                const amountValue = String(amountNumber);

                db.get(
                    "SELECT id, name, employees FROM salary_files WHERE id = ?",
                    [fileId],
                    (err, file) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء جلب الملف",
                                error: err.message
                            });
                        }

                        if (!file) {
                            return res.status(404).json({
                                success: false,
                                message: "الملف غير موجود"
                            });
                        }

                        let employees;
                        try {
                            employees = JSON.parse(file.employees || "[]");
                        } catch (error) {
                            return res.status(500).json({
                                success: false,
                                message: "بيانات الموظفين غير صالحة",
                                error: error.message
                            });
                        }

                        if (!Array.isArray(employees)) {
                            return res.status(500).json({
                                success: false,
                                message: "بيانات الموظفين غير صالحة"
                            });
                        }

                        const employeeIndex = employees.findIndex(
                            employee => employee && String(employee.id) === String(employeeId)
                        );

                        if (employeeIndex === -1) {
                            return res.status(404).json({
                                success: false,
                                message: "الموظف غير موجود"
                            });
                        }

                        const employee = employees[employeeIndex];

                        const advances = Array.isArray(employee.advances) ? employee.advances : [];

                        let advanceRecord = advances.find(
                            advance =>
                                advance &&
                                typeof advance === "object" &&
                                advance.days &&
                                typeof advance.days === "object" &&
                                !Array.isArray(advance.days)
                        );

                        if (amountNumber === 0) {
                            if (advanceRecord) {
                                delete advanceRecord.days[dayValue];

                                if (Object.keys(advanceRecord.days).length === 0) {
                                    const recordIndex = advances.indexOf(advanceRecord);
                                    if (recordIndex !== -1) {
                                        advances.splice(recordIndex, 1);
                                    }
                                }
                            }
                        } else {
                            if (!advanceRecord) {
                                advanceRecord = { days: {} };
                                advances.push(advanceRecord);
                            }
                            advanceRecord.days[dayValue] = amountValue;
                        }

                        employees[employeeIndex] = { ...employee, advances };

                        db.run(
                            "UPDATE salary_files SET employees = ? WHERE id = ?",
                            [JSON.stringify(employees), fileId],
                            function (updateError) {
                                if (updateError) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "حدث خطأ أثناء حفظ السلفة",
                                        error: updateError.message
                                    });
                                }

                                return res.status(200).json({
                                    success: true,
                                    message: amountNumber === 0 ? "تم حذف السلفة من اليوم بنجاح" : "تم إضافة السلفة بنجاح",
                                    fileId,
                                    employeeId,
                                    day: dayValue,
                                    amount: amountValue,
                                    employee: employees[employeeIndex]
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

router.post("/salary", (req, res) => {
    const { token, fileId, employeeId, day, amount } = req.body;

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

        const userId = decoded.id || decoded.userId || decoded._id || decoded.user_id || decoded.sub;

        if (!userId) {
            return res.status(401).json({
                success: false,
                message: "بيانات التوكين غير صحيحة"
            });
        }

        userDb.get(
            "SELECT id, account_type FROM users WHERE id = ? LIMIT 1",
            [userId],
            (userError, user) => {
                if (userError) {
                    return res.status(500).json({
                        success: false,
                        message: "حدث خطأ أثناء التحقق من المستخدم",
                        error: userError.message
                    });
                }

                if (!user) {
                    return res.status(404).json({
                        success: false,
                        message: "المستخدم غير موجود"
                    });
                }

                if (user.account_type !== "admin") {
                    return res.status(403).json({
                        success: false,
                        message: "غير مسموح لك بتعديل الرواتب"
                    });
                }

                if (!fileId || !employeeId || day === undefined || day === null || day === "") {
                    return res.status(400).json({
                        success: false,
                        message: "fileId و employeeId و day مطلوبة"
                    });
                }

                const dayNumber = Number(day);

                if (!Number.isInteger(dayNumber) || dayNumber < 1 || dayNumber > 31) {
                    return res.status(400).json({
                        success: false,
                        message: "اليوم يجب أن يكون رقمًا من 1 إلى 31"
                    });
                }

                if (
                    amount === undefined ||
                    amount === null ||
                    amount === "" ||
                    !Number.isFinite(Number(amount)) ||
                    Number(amount) < 0 ||
                    Number(amount) > 2
                ) {
                    return res.status(400).json({
                        success: false,
                        message: "قيمة الراتب يجب أن تكون من 0 إلى 2"
                    });
                }

                const dayValue = String(dayNumber);
                const amountValue = String(Number(amount));

                db.get(
                    "SELECT id, name, employees FROM salary_files WHERE id = ?",
                    [fileId],
                    (err, file) => {
                        if (err) {
                            return res.status(500).json({
                                success: false,
                                message: "حدث خطأ أثناء جلب الملف",
                                error: err.message
                            });
                        }

                        if (!file) {
                            return res.status(404).json({
                                success: false,
                                message: "الملف غير موجود"
                            });
                        }

                        let employees;
                        try {
                            employees = JSON.parse(file.employees || "[]");
                        } catch (error) {
                            return res.status(500).json({
                                success: false,
                                message: "بيانات الموظفين غير صالحة",
                                error: error.message
                            });
                        }

                        if (!Array.isArray(employees)) {
                            return res.status(500).json({
                                success: false,
                                message: "بيانات الموظفين غير صالحة"
                            });
                        }

                        const employeeIndex = employees.findIndex(
                            employee => employee && String(employee.id) === String(employeeId)
                        );

                        if (employeeIndex === -1) {
                            return res.status(404).json({
                                success: false,
                                message: "الموظف غير موجود"
                            });
                        }

                        const employee = employees[employeeIndex];

                        const salaryRecords = Array.isArray(employee.salaryRecords) ? employee.salaryRecords : [];

                        let salaryRecord = salaryRecords.find(
                            record =>
                                record &&
                                typeof record === "object" &&
                                record.days &&
                                typeof record.days === "object" &&
                                !Array.isArray(record.days)
                        );

                        if (!salaryRecord) {
                            salaryRecord = { days: {} };
                            salaryRecords.push(salaryRecord);
                        }

                        salaryRecord.days[dayValue] = amountValue;

                        employees[employeeIndex] = { ...employee, salaryRecords };

                        db.run(
                            "UPDATE salary_files SET employees = ? WHERE id = ?",
                            [JSON.stringify(employees), fileId],
                            function (updateError) {
                                if (updateError) {
                                    return res.status(500).json({
                                        success: false,
                                        message: "حدث خطأ أثناء حفظ الراتب",
                                        error: updateError.message
                                    });
                                }

                                return res.status(200).json({
                                    success: true,
                                    message: "تم حفظ الراتب بنجاح",
                                    fileId,
                                    employeeId,
                                    day: dayValue,
                                    amount: amountValue,
                                    employee: employees[employeeIndex]
                                });
                            }
                        );
                    }
                );
            }
        );
    });
});

module.exports = router;
