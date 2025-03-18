import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const adminSchema = new Schema({
    isVerified: {
        type: Boolean,
        default: false,
    },
    userid : {
        type:Number,
        required:true,
        unique:true,
        index:true,
        trim:true,    
    },
    password: {
        type: String,
        required: [true, "Password is required"],
    },
    refreshToken: {
        type: String,
        // select: false,
    }
},
    {
        timestamps: true,
    })

adminSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next()
}) //to encrypt the password

adminSchema.methods.isPasswordCorrect = async function (password) {
    const result = await bcrypt.compare(password, this.password)
    return result
}

adminSchema.methods.generateAccessToken = async function () {
    return jwt.sign({
        _id: this._id,
        email: this.email,
        username: this.username,
        fullName: this.fullName
    },
        process.env.ACCESS_TOKEN_SECRET,
        {
            expiresIn: process.env.ACCESS_TOKEN_EXPIRY
        }
    )
}
adminSchema.methods.generateRefreshToken = async function () {
    return jwt.sign({
        _id: this._id,
    },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const Admin=mongoose.model("Admin", adminSchema)