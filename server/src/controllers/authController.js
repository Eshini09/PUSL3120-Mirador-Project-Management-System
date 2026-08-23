const {
    registerUser,
    loginUser
} = require("../services/authService");

const login = async (req, res) => {
    try {
        const result = await loginUser(req.body);

        res.status(200).json(result);
    } catch (error) {
        if (error.message === "Invalid email or password") {
            return res.status(401).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: "Login failed"
        });
    }
};

const register = async (req, res) => {
    try {
        const user = await registerUser(req.body);

        res.status(201).json({
            message: "User registered successfully",
            user
        });
    } catch (error) {
        if (
            error.message === "A user with this email already exists"
        ) {
            return res.status(409).json({
                message: error.message
            });
        }

        if (
            error.message === "Name, email and password are required" ||
            error.message === "Password must be at least 8 characters long"
        ) {
            return res.status(400).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: "Registration failed"
        });
    }
};

module.exports = {
    register,
    login
};