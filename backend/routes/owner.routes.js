import { Router } from "express";
import { verifyAdmin } from "../controllers/owner.controller.js";

// import { upload } from "../middlewares/multer.middleware.js";
// import { verifyJWT } from "../middlewares/auth.middleware.js";
const router = Router();

router.route("/verify").post(verifyAdmin)



export default router;