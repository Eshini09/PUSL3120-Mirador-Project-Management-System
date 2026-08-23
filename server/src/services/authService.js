const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const User = require("../models/User");

const registerUser = async ({ name, email, password }) => {
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

    const user = await User.create({
        name: name.trim(),
        email: normalizedEmail,
        password: hashedPassword
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