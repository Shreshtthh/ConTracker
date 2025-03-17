import mongoose, { Schema } from "mongoose"
import jwt from "jsonwebtoken"
import bcrypt from "bcrypt"

const citizenSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
        trim: true,
    },
    dp:{
        type: String ,
    },
    // reviewHistory:[{
    //     type:Schema.Types.ObjectId,
    //     ref:"review"
    // }],
    password: {
        type: String,
        required: [true, "Password is true"],
    },
    refreshToken: {
        type: String,
        // select: false,
    }
},
    {
        timestamps: true,
    })

citizenSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();
    this.password = await bcrypt.hash(this.password, 10);
    next()
}) //to encrypt the password

citizenSchema.methods.isPasswordCorrect = async function (password) {
    const result = await bcrypt.compare(password, this.password)
    return result
}

citizenSchema.methods.generateAccessToken = async function () {
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
citizenSchema.methods.generateRefreshToken = async function () {
    return jwt.sign({
        _id: this._id,
    },
        process.env.REFRESH_TOKEN_SECRET,
        {
            expiresIn: process.env.REFRESH_TOKEN_EXPIRY
        }
    )
}

export const Citizen=mongoose.model("Citizen", citizenSchema)