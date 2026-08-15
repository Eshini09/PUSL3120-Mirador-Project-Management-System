const bcrypt = require("bcrypt");
const User = require("../models/User");

const registerUser = async ({ name, email, password }) => {
    const existingUser = await User.findOne({ email });

    if (existingUser) {
        throw new Error("A user with this email already exists");
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const user = await User.create({
        name,
        email,
        password: hashedPassword
    });

    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
    };
};

module.exports = {
    registerUser
};