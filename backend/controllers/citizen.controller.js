import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Citizen } from "../models/citizen.model.js";
import { UploadOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import fs from "fs";
import jwt from "jsonwebtoken"

const generateAccessAndRefreshToken=async(citizenId)=>{
    try{    
        const citizen = await Citizen.findById(citizenId);
        let AccessToken=await citizen.generateAccessToken()
        let RefreshToken=await citizen.generateRefreshToken()
        // console.log(AccessToken, RefreshToken)
        citizen.refreshToken= RefreshToken;
        await citizen.save({validateBeforeSave: false});
        return {AccessToken, RefreshToken}
    }catch(e){
        throw new ApiError(500, "Something went wrong generating tokens")
    }
}

export const registerCitizen=asyncHandler(async(req,res)=>{
    // console.log(req.body);
    const {username, email, password}= req.body;

    if ([username, email, password].some((fields) => fields?.trim() === "")) {
        throw new ApiError(400, "All Fields are required")
    }
    // console.log(username, email, password);

    const ExistedCitizen=  await Citizen.findOne({email});
    // console.log(ExistedCitizen)
    if (ExistedCitizen) {
        throw new ApiError(400, "User with email or username already exist")
    }

    // console.log(req.body);

    const dpPath = req.files?.dp?.[0]?.path;
    // console.log(dpPath);
    const dp = await UploadOnCloudinary(dpPath);
    // console.log(dp)
    if (!dp) {
        throw new ApiError(400, "Please upload a profile picture")
    }

    const citizen = await Citizen.create({
        username,
        email,
        password,
        dp: dp.url
    })

    const createdCitizen = await Citizen.findById(citizen._id).select("-password -refreshToken")

    if (!createdCitizen) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    return res.status(201).json(new ApiResponse(201, "Citizen registered successfully", createdCitizen))
})

export const loginCitizen=asyncHandler(async(req,res)=>{
    if (!req.body || Object.keys(req.body).length === 0) {
        throw new ApiError(400,"request body is empty");
    }
    const {email,username,password}=req.body
    if (!email || !password) {
        throw new ApiError(400, "Email and password are required")
    }
    const citizen= await Citizen.findOne({email}).select("+password +refreshToken")
    if (!citizen) {
        throw new ApiError(400, "Invalid email or password")
    }
    const checkPassword= await citizen.isPasswordCorrect(password)
    if (!checkPassword) {
        throw new ApiError(400, "Invalid email or password")
    }
    const {AccessToken, RefreshToken}=await generateAccessAndRefreshToken(citizen._id)
    citizen.refreshToken=RefreshToken
    await citizen.save({validateBeforeSave:false});
    const LoggedinCitizen=await Citizen.findById(citizen._id).select("-password -refreshToken")
    const option={
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .cookie("accessToken",AccessToken,option)
    .cookie("refreshtoken",RefreshToken,option)
    .json(
        new ApiResponse(200,{
            Citizen:LoggedinCitizen,AccessToken,RefreshToken},"User LoggedIn Successfully")
    )

})

export const logoutCitizen=asyncHandler(async(req,res)=>{
    const citizenid=await req.citizen._id
    await Citizen.findByIdAndUpdate((citizenid), {
        $set:{
            refreshToken: undefined
        },
    },
    {
        new: true,
    }
    )
    const option={
        httpOnly:true,
        secure:true
    }
    return res
    .status(200)
    .clearCookie("accessToken", option)
    .clearCookie("refreshtoken", option)
    .json(new ApiResponse(200,{},"User logged out succesfully"))
})


export const refreshAccessToken=asyncHandler(async(req,res)=>{
    try {
        // console.log(req.cookies)
        const incomingRefreshToken=req.cookies.refreshtoken|| req.body.refreshToken
        // console.log(incomingRefreshToken)
        if(!incomingRefreshToken){
            throw new ApiError(401,"Unauthorized request")
        }
        const decodedToken=jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        const citizen=await Citizen.findById(decodedToken?._id).select("+refreshToken")
        // console.log(user);
        if(!citizen){
            throw new ApiError(401,"User not found")
        }
        // console.log(user?.refreshToken)
        // console.log(incomingRefreshToken)
        if(incomingRefreshToken !== citizen?.refreshToken){
            throw new ApiError(401,"Refresh token is expired")
        }
        const option={
            httpOnly:true,
            secure:true
        }
        const token=await generateAccessAndRefreshToken(citizen._id)
        // const {accessToken, newrefreshToken}=await generateAccessAndRefreshToken(user._id)
        // console.log(token)
        const {AccessToken, RefreshToken}=token
        // console.log(AccessToken)
        // console.log(RefreshToken)
        citizen.refreshToken=RefreshToken;
        await citizen.save()
        return res.status(200)
        .cookie("accessToken",AccessToken,option)
        .cookie("refreshtoken",RefreshToken, option)
        .json(new ApiResponse(200,{AccessToken, RefreshToken},"AccessToken Refreshed"))
    } catch (error) {
        throw new ApiError(401,error.message)
    }
})
