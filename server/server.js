require("dotenv").config();

const authRoutes = require("./src/routes/authRoutes");

const express = require("express");
const connectDB = require("./src/config/db");

const app = express();

const PORT = process.env.PORT || 5001;

app.get("/api/health", (req, res) => {
    res.json({
        status: "OK"
    });
});

const startServer = async () => {
    await connectDB();

    app.listen(PORT, () => {
        console.log(`Mirador server running on port ${PORT}`);
    });
};

app.use(express.json());

app.use("/api/auth", authRoutes);

startServer();