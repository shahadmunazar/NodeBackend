const express = require("express");
const { authenticateUser, authorizeRoles } = require("../middleware/auth");
const { getCurrentUser } = require("../controllers/authController");
const {CreateRoles,GetAllRoles,GetRoleById,CreateAdmin} = require("../controllers/SuperAdmin/rolesController")
const router = express.Router();


/**
 * Middleware wrapper to apply checkAuth and checkRole globally to routes.
 * @param {Function} handler - The route handler function.
 * @param {string} role - Role to check for access.
 * @returns {Function} - Middleware with checkAuth, checkRole, and the handler.
 */
const withAuthAndRole = (handler, role = "admin") => [authenticateUser, authorizeRoles(role), handler];


router.post('/rolse-create', ...withAuthAndRole(CreateRoles));
// GetAllRoles
router.get('/roles-get', ...withAuthAndRole(GetAllRoles));
//GetRoleById
router.get('/roles-details', ...withAuthAndRole(GetRoleById));
router.post('/create-admins', ...withAuthAndRole(CreateAdmin));


router.get("/admin", authenticateUser, authorizeRoles("admin"), (req, res) => {
    res.json({ message: "Welcome Admin!" });
});


router.get("/user", authenticateUser, getCurrentUser);


router.get("/user", authenticateUser, authorizeRoles("user"), (req, res) => {
    res.json({ message: "Welcome User!" });
});


router.get("/manager", authenticateUser, authorizeRoles("manager"), (req, res) => {
    res.json({ message: "Welcome Manager!" });
});

// ✅ Officer Route
router.get("/officer", authenticateUser, authorizeRoles("officer"), (req, res) => {
    res.json({ message: "Welcome Officer!" });
});

// ✅ Technician Route
router.get("/technician", authenticateUser, authorizeRoles("technician"), (req, res) => {
    res.json({ message: "Welcome Technician!" });
});

// ✅ Compliance Route
router.get("/compliance", authenticateUser, authorizeRoles("compliance"), (req, res) => {
    res.json({ message: "Welcome Compliance Officer!" });
});

module.exports = router;

