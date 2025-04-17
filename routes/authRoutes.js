const express = require("express");
const { login, getCurrentUser, verifyOtp } = require("../controllers/authController");

const {SubmitEnquiry} = require("../controllers/API/EnquirySection/enquiryController");
const { authenticateUser } = require("../middleware/auth");
const {ForgetPassword, UpdatePassword} = require("../controllers/API/SuperAdminController/ProfileController");

const router = express.Router();

router.post("/login", login);
router.post("/submit-enquiry",SubmitEnquiry);
router.post("/verify-otp", verifyOtp); // Step 2: Verify OTP & generate token
router.post("/forget-password", ForgetPassword);
router.post("/update-password", UpdatePassword);


router.get("/me", authenticateUser, getCurrentUser);

module.exports = router;
