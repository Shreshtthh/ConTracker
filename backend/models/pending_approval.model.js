import mongoose from "mongoose";

const pendingApprovalSchema = new mongoose.Schema({
    status: {
        type: String,
        required: true,
    },
})

export const PendingApproval = mongoose.model("PendingApproval", pendingApprovalSchema);