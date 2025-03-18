import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { Admin } from "../models/admin.model.js";
import { PendingApproval } from "../models/pending_approval.model.js";

const generateAccessAndRefreshToken = async (adminId) => {
    try {
        const admin = await Admin.findById(adminId);
        let AccessToken = await admin.generateAccessToken()
        let RefreshToken = await admin.generateRefreshToken()
        admin.refreshToken = RefreshToken;
        await admin.save({ validateBeforeSave: false });
        return { AccessToken, RefreshToken }
    } catch (e) {
        throw new ApiError(500, "Something went wrong generating tokens")
    }
}

const sendVerificationRequestToOwner = async (adminId) => {
    // Fetch the admin details
    const admin = await Admin.findById(adminId).select("userid");
    if (!admin) {
        throw new ApiError(404, "Admin not found");
    }

    // Fetch the owner's email (assuming owner is stored in the database)
    // const owner = await User.findOne({ role: "owner" }).select("email");
    // if (!owner) {
    //     throw new ApiError(404, "Owner not found");
    // }

    // Send an email to the owner
    const emailSubject = "New Admin Registration Request";
    const emailBody = `
        A new admin registration request has been submitted.
        Admin ID: ${admin.userid}
        Please verify and approve the request.
    `;

    // await sendEmail(owner.email, emailSubject, emailBody);

    // Alternatively, you can add the request to a "pending approvals" collection
    await PendingApproval.create({
        adminId: admin._id,
        status: "pending",
    });
};

export const registerAdmin = asyncHandler(async (req, res) => {
    console.log(req.body)
    const { userid, password } = req.body;
    console.log(userid, password)

    if ([userid, password].some((fields) => fields?.trim() === "")) {
        throw new ApiError(400, "All Fields are required")
    }

    const ExistedAdmin = await Admin.findOne({ userid });

    if (ExistedAdmin) {
        throw new ApiError(400, "User with email or username already exist")
    }

    const admin = await Admin.create({
        userid,
        password,
    })

    const createdAdmin = await Admin.findById(admin._id).select("-password -refreshToken")

    await sendVerificationRequestToOwner(createdAdmin._id);

    if (!createdAdmin) {
        throw new ApiError(500, "Something went wrong while registering the user")
    }

    const { AccessToken, RefreshToken } = await generateAccessAndRefreshToken(createdAdmin._id);
    res.status(201).json({
        status: "success",
        data: {
            admin: createdAdmin,
            AccessToken,
            RefreshToken
        }
    })
})

export const loginAdmin = asyncHandler(async (req, res) => {
    if (!req.body || Object.keys(req.body).length === 0) {
        throw new ApiError(400, "request body is empty");
    }
    const { userid, password} = req.body
    if (!userid || !password) {
        throw new ApiError(400, "Email and password are required")
    }
    // if(!isVerified){
    //     throw new ApiError(400, "Account not verified by the owner....Try again later")
    // }
    const admin = await Admin.findOne({ userid }).select("+password +refreshToken")
    console.log(admin)
    if (!admin) {
        throw new ApiError(400, "Invalid email or password")
    }
    if(admin.isVerified===false){
        throw new ApiError(400, "Account not verified by the owner....Try again later")
    }
    const checkPassword = await admin.isPasswordCorrect(password)
    if (!checkPassword) {
        throw new ApiError(400, "Invalid email or password")
    }
    const { AccessToken, RefreshToken } = await generateAccessAndRefreshToken(admin._id)
    res.status(200)
    .cookie("accessToken", AccessToken, {
        httpOnly: true,
        secure: true,
    })
    .cookie("refreshToken", RefreshToken, {
        httpOnly: true,
        secure: true,
    })
    .json({
        status: "success",
        data: {
            admin: {
                _id: admin._id,
                userid: admin.userid,
                isVerified: admin.isVerified,
            },
            AccessToken,
            RefreshToken
        }
    })
})

export const logoutAdmin = asyncHandler(async (req, res) => {
    const adminid = await req.admin._id
    await Admin.findByIdAndUpdate((adminid), {
        $set: {
            refreshToken: undefined
        },
    },
        {
            new: true,
        }
    )
    const option = {
        httpOnly: true,
        secure: true
    }
    return res
        .status(200)
        .clearCookie("accessToken", option)
        .clearCookie("refreshToken", option)
        .json({ message: "User logged out succesfully" })
})