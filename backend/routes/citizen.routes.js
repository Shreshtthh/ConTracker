import { Router } from "express";
import { registerCitizen, loginCitizen, logoutCitizen } from "../controllers/citizen.controller.js";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(
    upload.fields([
        {
            name: "dp",
            maxCount: 1
        },
        
    ]),
    registerCitizen)
router.route("/login").post(loginCitizen)
//secured route
router.route("/logout").post(verifyJWT,logoutCitizen)

export default router;