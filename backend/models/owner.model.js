import mongoose from "mongoose";
import bcrypt from "bcrypt";

const ownerSchema = new mongoose.Schema({
    password: {
        type: String,
        required: [true, "Password is true"],
    },
    requests: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Request"
    }],
},
    {
        timestamps: true,
    }
)

export const Owner=mongoose.model("Owner", ownerSchema)

