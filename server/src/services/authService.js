const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const registerUser = async ({ name, email, password, role }) => {
    if (!name || !email || !password) {
        throw new Error("Name, email and password are required");
    }

    const normalizedEmail = email.trim().toLowerCase();

    if (password.length < 8) {
        throw new Error("Password must be at least 8 characters long");
    }

    const existingUser = await User.findOne({
        email: normalizedEmail
    });

    if (existingUser) {
        throw new Error("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const existingUserCount = await User.countDocuments();
    const allowedSelfRegistrationRoles = [
        "PROJECT_MANAGER",
        "TEAM_MEMBER"
    ];

    const assignedRole =
        existingUserCount === 0
            ? "ADMIN"
            : allowedSelfRegistrationRoles.includes(role)
              ? role
              : "TEAM_MEMBER";

    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword,
        role: assignedRole
    });

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    };
};

const loginUser = async ({ email, password }) => {
    const user = await User.findOne({ email });

    if (!user) {
        throw new Error("Invalid email or password");
    }

    const passwordMatches = await bcrypt.compare(password, user.password);

    if (!passwordMatches) {
        throw new Error("Invalid email or password");
    }

    const token = jwt.sign(
        {
            userId: user._id,
            role: user.role
        },
        process.env.JWT_SECRET,
        {
            expiresIn: "1h"
        }
    );

    return {
        token,
        user: {
            id: user._id,
            name: user.name,
            email: user.email,
            role: user.role
        }
    };
};

module.exports = {
    registerUser,
    loginUser
};
