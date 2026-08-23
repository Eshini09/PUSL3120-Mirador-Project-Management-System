const mongoose = require("mongoose");

const taskCommentSchema = new mongoose.Schema(
    {
        body: {
            type: String,
            required: true,
            trim: true
        },

        task: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Task",
            required: true
        },

        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        }
    },
    {
        timestamps: true
    }
);

module.exports = mongoose.model("TaskComment", taskCommentSchema);
