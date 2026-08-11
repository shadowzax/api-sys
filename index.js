const express = require("express");
const os = require("os");
const fetch = require("node-fetch");
const cors = require("cors");
const path = require("path");
const app = express();
const PORT = 8040;

const dbModule = require("./mydb/users");
const db = dbModule.db;

app.use(cors());
app.use(express.static(path.join(__dirname, "public")));
app.use(express.json());
app.set('trust proxy', 1);

app.get("/", (req, res) => {
    res.send("Server Running");
});
/*------------------------------------------------*/

const routes = ["auth","admin/create"];

routes.forEach(route => {
    app.use(`/api/${route}`, require(`./routes/${route}`));
});

/*------------------------------------------------*/
app.get("/users", (req, res) => {
    db.all("SELECT * FROM users", [], (err, rows) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }

        const parsedUsers = rows.map(user => ({
            ...user
        }));

        res.json({
            success: true,
            users: parsedUsers
        });
    });
});
app.get("/users/profile-picture", (req, res) => {
    const { phone_number, profile_picture } = req.query;

    if (!phone_number || !profile_picture) {
        return res.status(400).json({
            success: false,
            error: "phone_number و profile_picture مطلوبان"
        });
    }

    db.run(
        "UPDATE users SET profile_picture = ? WHERE phone_number = ?",
        [profile_picture, phone_number],
        function (err) {
            if (err) {
                return res.status(500).json({
                    success: false,
                    error: err.message
                });
            }

            if (this.changes === 0) {
                return res.status(404).json({
                    success: false,
                    error: "المستخدم غير موجود"
                });
            }

            res.json({
                success: true,
                message: "تم تحديث رابط صورة الملف الشخصي بنجاح",
                phone_number,
                profile_picture
            });
        }
    );
});
app.get("/dusers", (req, res) => {
    db.run("DELETE FROM users", [], function (err) {
        if (err) {
            return res.status(500).json({
                success: false,
                error: err.message
            });
        }

        res.json({
            success: true,
            message: "All accounts deleted successfully",
            deleted_accounts: this.changes
        });
    });
});
/*------------------------------------------------*/
app.listen(PORT, "0.0.0.0", () => {
    console.log("Server started!");
    console.log("Port:", PORT);
    console.log("Server IP: http://108.181.221.18:" + PORT);
});
