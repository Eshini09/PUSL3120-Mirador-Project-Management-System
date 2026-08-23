const mongoose = require("mongoose");

const teamInviteSchema = new mongoose.Schema(
    {
        token: {
            type: String,
            required: true,
            unique: true
        },

        team: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Team",
            required: true
        },

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        status: {
            type: String,
            enum: ["OPEN", "CLOSED"],
            default: "OPEN"
        },

        acceptedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        declinedBy: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ]
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("TeamInvite", teamInviteSchema);
