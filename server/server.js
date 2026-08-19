const cors = require("cors");

const projectRoutes = require("./src/routes/projectRoutes");

const userRoutes = require("./src/routes/userRoutes");

const authenticate = require("./src/middleware/authMiddleware");
require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");

const { Server } = require("socket.io");

const express = require("express");
const app = express();

const http = require("http");
const server = http.createServer(app);

app.use(
    cors({
        origin: "http://localhost:5173"
    })
);

app.use(express.json());

app.use("/api/users", userRoutes);

const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173"
    }
});

app.set("io", io);

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

    server.listen(PORT, () => {
        console.log(`Mirador server running on port ${PORT}`);
    });
};

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

startServer();