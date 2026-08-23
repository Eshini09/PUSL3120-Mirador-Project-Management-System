const mongoose = require("mongoose");

const milestoneSchema = new mongoose.Schema(
    {
        title: {
            type: String,
            required: true,
            trim: true
        },

        description: {
            type: String,
            trim: true
        },

        status: {
            type: String,
            enum: ["PLANNED", "IN_PROGRESS", "ACHIEVED", "MISSED"],
            default: "PLANNED"
        },

        dueDate: {
            type: Date,
            required: true
        },

        project: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Project",
            required: true
        },

        owner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },

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

module.exports = mongoose.model("Milestone", milestoneSchema);
