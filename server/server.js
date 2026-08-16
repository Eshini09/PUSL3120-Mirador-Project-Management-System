const projectRoutes = require("./src/routes/projectRoutes");

const authenticate = require("./src/middleware/authMiddleware");
require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");

const express = require("express");
const app = express();

app.use(express.json());

const connectDB = require("./src/config/db");

const PORT = process.env.PORT || 5001;

const taskRoutes = require("./src/routes/taskRoutes");

app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK"
    });
});

app.get("/api/auth/me", authenticate, (req, res) => {
    res.json({
        user: req.user
    });
});

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Mirador server running on port ${PORT}`);
    });
};

startServer();