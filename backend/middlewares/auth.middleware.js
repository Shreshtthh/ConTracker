import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from "jsonwebtoken"  
import { Citizen } from "../models/citizen.model.js";

export const verifyJWT= asyncHandler(async(req, _,next)=>{
    try{
        const token = req.cookies.accessToken;
        console.log(token)
        if (!token) {
            throw new ApiError(401, "Unauthorized request")
        }
        const decoded= jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
        console.log(decoded)
        const citizen= await Citizen.findById(decoded._id).select("-password -refreshToken")
        if (!citizen) {
            throw new ApiError(401, "Unauthorized")
        }
        req.citizen=citizen;
        next()
    } catch(e){
        throw new ApiError(401, "Invalid access token")
    }   
})