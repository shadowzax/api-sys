const express = require("express");
const router = express.Router();

const {
    db,
    createSalaryFile
} = require("../../mydb/salary");

router.post("/delete-folder", (req, res) => {
    try {
        const { folderId, password } = req.body;

        if (!password || password !== "01025") {
            return res.status(401).json({
                success: false,
                message: "الباسورد غير صحيح"
            });
        }

        if (
            !folderId ||
            typeof folderId !== "string" ||
            !folderId.trim()
        ) {
            return res.status(400).json({
                success: false,
                message: "معرف الفايل مطلوب"
            });
        }

        const id = folderId.trim();

        db.run(
            "DELETE FROM salary_files WHERE id = ?",
            [id],
            function (error) {
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
            }
        );

    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "حدث خطأ أثناء حذف الفايل",
            error: error.message
        });
    }
});
/*----------------------------------------------*/
router.post("/create", async (req, res) => {
    try {
        const {
            name = "",
            employees = []
        } = req.body;

        if (!name || typeof name !== "string" || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "اسم الملف مطلوب"
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
                salaryRecords: Array.isArray(employee.salaryRecords)
                    ? employee.salaryRecords
                    : [],
                advances: Array.isArray(employee.advances)
                    ? employee.advances
                    : []
            };
        });

        const file = await createSalaryFile(
            name.trim(),
            formattedEmployees
        );

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
/*--------------------------------------------------*/

router.post("/add-employee", (req, res) => {
    const {
        fileId = "",
        name = "",
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

    db.get(
        `
        SELECT id, name, created_at, employees
        FROM salary_files
        WHERE id = ?
        `,
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

            const employeeId = `id_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

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
                profession: profession.trim(),
                monthlySalary: String(monthlySalary),
                salaryRecords: [],
                advances: []
            };

            employees.push(employee);

            db.run(
                `
                UPDATE salary_files
                SET employees = ?
                WHERE id = ?
                `,
                [
                    JSON.stringify(employees),
                    fileId.trim()
                ],
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
        name = "",
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

    db.get(
        `
        SELECT id, name, created_at, employees
        FROM salary_files
        WHERE id = ?
        `,
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

            const employeeIndex = employees.findIndex(
                employee => employee.id === employeeId.trim()
            );

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            employees[employeeIndex] = {
                ...employees[employeeIndex],
                name: name.trim(),
                profession: profession.trim(),
                monthlySalary: String(monthlySalary)
            };

            db.run(
                `
                UPDATE salary_files
                SET employees = ?
                WHERE id = ?
                `,
                [
                    JSON.stringify(employees),
                    fileId.trim()
                ],
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
    const {
        fileId = "",
        employeeId = "",
        password = ""
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

    if (!password || typeof password !== "string" || !password.trim()) {
        return res.status(400).json({
            success: false,
            message: "كلمة المرور مطلوبة"
        });
    }

    if (password.trim() !== "01025") {
        return res.status(401).json({
            success: false,
            message: "كلمة المرور غير صحيحة"
        });
    }

    db.get(
        `
        SELECT id, name, created_at, employees
        FROM salary_files
        WHERE id = ?
        `,
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
                employee => employee.id === employeeId.trim()
            );

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            const deletedEmployee = employees.splice(employeeIndex, 1)[0];

            db.run(
                `
                UPDATE salary_files
                SET employees = ?
                WHERE id = ?
                `,
                [
                    JSON.stringify(employees),
                    fileId.trim()
                ],
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
                        employee: deletedEmployee
                    });
                }
            );
        }
    );
});

router.get("/", (req, res) => {
    db.all(
        `
        SELECT id, name, created_at, employees
        FROM salary_files
        ORDER BY created_at DESC
        `,
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
    const {
        fileId,
        employeeId,
        day,
        amount
    } = req.body;

    if (!fileId || !employeeId || day === undefined || day === null || day === "") {
        return res.status(400).json({
            success: false,
            message: "fileId و employeeId و day مطلوبة"
        });
    }

    const dayNumber = Number(day);

    if (
        !Number.isInteger(dayNumber) ||
        dayNumber < 1 ||
        dayNumber > 31
    ) {
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
        `
        SELECT id, name, employees
        FROM salary_files
        WHERE id = ?
        `,
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
                employee =>
                    employee &&
                    String(employee.id) === String(employeeId)
            );

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            const employee = employees[employeeIndex];

            const advances = Array.isArray(employee.advances)
                ? employee.advances
                : [];

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
                    advanceRecord = {
                        days: {}
                    };

                    advances.push(advanceRecord);
                }

                advanceRecord.days[dayValue] = amountValue;
            }

            employees[employeeIndex] = {
                ...employee,
                advances
            };

            db.run(
                `
                UPDATE salary_files
                SET employees = ?
                WHERE id = ?
                `,
                [
                    JSON.stringify(employees),
                    fileId
                ],
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
                        message: amountNumber === 0
                            ? "تم حذف السلفة من اليوم بنجاح"
                            : "تم إضافة السلفة بنجاح",
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
});
router.post("/salary", (req, res) => {
    const {
        fileId,
        employeeId,
        day,
        amount
    } = req.body;

    if (
        !fileId ||
        !employeeId ||
        day === undefined ||
        day === null ||
        day === ""
    ) {
        return res.status(400).json({
            success: false,
            message: "fileId و employeeId و day مطلوبة"
        });
    }

    const dayNumber = Number(day);

    if (
        !Number.isInteger(dayNumber) ||
        dayNumber < 1 ||
        dayNumber > 31
    ) {
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
        `
        SELECT id, name, employees
        FROM salary_files
        WHERE id = ?
        `,
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
                employee =>
                    employee &&
                    String(employee.id) === String(employeeId)
            );

            if (employeeIndex === -1) {
                return res.status(404).json({
                    success: false,
                    message: "الموظف غير موجود"
                });
            }

            const employee = employees[employeeIndex];

            const salaryRecords = Array.isArray(employee.salaryRecords)
                ? employee.salaryRecords
                : [];

            let salaryRecord = salaryRecords.find(
                record =>
                    record &&
                    typeof record === "object" &&
                    record.days &&
                    typeof record.days === "object" &&
                    !Array.isArray(record.days)
            );

            if (!salaryRecord) {
                salaryRecord = {
                    days: {}
                };

                salaryRecords.push(salaryRecord);
            }

            salaryRecord.days[dayValue] = amountValue;

            employees[employeeIndex] = {
                ...employee,
                salaryRecords
            };

            db.run(
                `
                UPDATE salary_files
                SET employees = ?
                WHERE id = ?
                `,
                [
                    JSON.stringify(employees),
                    fileId
                ],
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
});
module.exports = router;
