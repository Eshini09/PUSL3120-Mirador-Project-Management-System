const { registerUser } = require("../services/authService");

const register = async (req, res) => {
    try {
        const user = await registerUser(req.body);

        res.status(201).json({
            message: "User registered successfully",
            user
        });
    } catch (error) {
        if (error.message === "A user with this email already exists") {
            return res.status(409).json({
                message: error.message
            });
        }

        res.status(500).json({
            message: "Registration failed"
        });
    }
};

module.exports = {
    register
};