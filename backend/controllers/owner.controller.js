import { asyncHandler } from "../utils/asyncHandler.js";   
import { ApiError } from "../utils/ApiError.js";
import { Owner } from "../models/owner.model.js";
import { Admin } from "../models/admin.model.js";
import { PendingApproval } from "../models/pending_approval.model.js";

export const verifyAdmin = asyncHandler(async (req, res) => {
    const { adminId } = req.body;

    // Validate input
    if (!adminId) {
        throw new ApiError(400, "Admin ID is required");
    }

    // Find the admin
    const admin = await Admin.findById(adminId);
    if (!admin) {
        throw new ApiError(404, "Admin not found");
    }

    // Update isVerified to true
    admin.isVerified = true;
    await admin.save();

    await PendingApproval.findOneAndDelete({
        adminId: admin._id,
    });

    // Notify the admin that their account has been verified
    const emailSubject = "Admin Account Verified";
    const emailBody = `
        Your admin account has been verified by the owner.
        You can now log in and access the admin dashboard.
    `;
    // await sendEmail(admin.userid, emailSubject, emailBody);

    // Respond to the owner
    res.status(200).json({
        status: "success",
        message: "Admin account verified successfully.",
        data: {
            admin: {
                _id: admin._id,
                userid: admin.userid,
                isVerified: admin.isVerified,
            },
        },
    });
});

