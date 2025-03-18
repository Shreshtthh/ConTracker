import mongoose from "mongoose";

const requestSchema = new mongoose.Schema({
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Admin",
    },

})

export const Request = mongoose.model("Request", requestSchema);
