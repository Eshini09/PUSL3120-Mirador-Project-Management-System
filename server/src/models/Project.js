const mongoose = require("mongoose");

const projectSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            required: true,
            trim: true
        },

        status: {
            type: String,
            enum: ["PLANNING", "ACTIVE", "COMPLETED", "ON_HOLD"],
            default: "PLANNING"
        },

        startDate: {
            type: Date,
            required: true
        },

        dueDate: {
            type: Date,
            required: true
        },

        manager: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        members: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "User"
            }
        ],

        teams: [
            {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Team"
            }
        ],

        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("Project", projectSchema);
