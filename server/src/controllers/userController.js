const User = require("../models/User");

const getUsers = async (req, res) => {
    try {
        const users = await User.find()
            .select("_id name email role")
            .sort({ name: 1 });

        res.status(200).json({
            users
        });
    } catch (error) {
        console.error("Get users error:", error);

        res.status(500).json({
            message: "Failed to retrieve users"
        });
    }
};

module.exports = {
    getUsers
};