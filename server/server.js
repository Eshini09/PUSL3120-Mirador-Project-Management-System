const cors = require("cors");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

require("dotenv").config();

const projectRoutes = require("./src/routes/projectRoutes");
const userRoutes = require("./src/routes/userRoutes");
const authRoutes = require("./src/routes/authRoutes");
const taskRoutes = require("./src/routes/taskRoutes");
const milestoneRoutes = require("./src/routes/milestoneRoutes");
const commentRoutes = require("./src/routes/commentRoutes");
const teamRoutes = require("./src/routes/teamRoutes");
const teamInviteRoutes = require("./src/routes/teamInviteRoutes");

const authenticate = require("./src/middleware/authMiddleware");
const connectDB = require("./src/config/db");
const User = require("./src/models/User");

const app = express();
const server = http.createServer(app);

const allowedOrigins = [
    "http://localhost:5173",
    "http://localhost:5174"
];

app.use(
    cors({
        origin: allowedOrigins
    })
);

app.use(express.json());
app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
});

const io = new Server(server, {
    cors: {
        origin: allowedOrigins
    }
});

app.set("io", io);

const PORT = process.env.PORT || 5001;

app.use("/api/users", userRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/milestones", milestoneRoutes);
app.use("/api/comments", commentRoutes);
app.use("/api/teams", teamRoutes);
app.use("/api", teamInviteRoutes);
app.use("/api/auth", authRoutes);

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK"
    });
});

app.get("/api/auth/me", authenticate, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select(
            "name email role"
        );

        if (!user) {
            return res.status(404).json({
                message: "User not found"
            });
        }

        return res.json({
            user: {
                userId: user._id.toString(),
                id: user._id.toString(),
                name: user.name,
                email: user.email,
                role: user.role
            }
        });
    } catch (error) {
        console.error("Get current user error:", error);

        return res.status(500).json({
            message: "Failed to retrieve current user"
        });
    }
});

app.use("/api", (req, res) => {
    res.status(404).json({
        message: "API route not found"
    });
});

io.on("connection", (socket) => {
    console.log(`Client connected: ${socket.id}`);

    socket.on("disconnect", () => {
        console.log(`Client disconnected: ${socket.id}`);
    });
});

const startServer = async () => {
    await connectDB();

    server.listen(PORT, () => {
        console.log(`Mirador server running on port ${PORT}`);
    });
};

if (require.main === module) {
    startServer();
}

module.exports = {
    app
};
