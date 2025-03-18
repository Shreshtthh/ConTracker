import { Router } from "express";
import { loginAdmin, logoutAdmin, registerAdmin } from "../controllers/admin.controller.js";
// import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/register").post(registerAdmin)

router.route("/login").post(loginAdmin)
//secured route
router.route("/logout").post(verifyJWT,logoutAdmin)

export default router;