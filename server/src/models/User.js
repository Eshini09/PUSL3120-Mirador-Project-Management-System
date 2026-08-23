const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        password: {
            type: String,
            required: true
        },

        role: {
            type: String,
            enum: ["ADMIN", "PROJECT_MANAGER", "TEAM_MEMBER"],
            default: "TEAM_MEMBER"
        },

        bio: {
            type: String,
            trim: true,
            maxlength: 240,
            default: ""
        },

        avatarColor: {
            type: String,
            enum: [
                "INDIGO",
                "TEAL",
                "CORAL",
                "AMBER",
                "GREEN",
                "LAVENDER",
                "ROSE",
                "PEACH",
                "MINT",
                "SKY",
                "LILAC",
                "LEMON"
            ],
            default: "INDIGO"
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("User", userSchema);
