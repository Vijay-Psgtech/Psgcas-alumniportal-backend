const express = require("express");
const router = express.Router();
const {
    getAllNewsLetters,
    getNewsLetterById,
    createNewsLetter,
    updateNewsLetter,
    deleteNewsLetter,
    getNewsLettersByCategory
} = require("../controllers/newsLetterController");
const upload = require("../middleware/uploads");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

router.get("/", getAllNewsLetters);
router.get("/:id", getNewsLetterById);

// ✅ FIXED v2: Using upload.any() for maximum compatibility
// This accepts ANY file fields without needing to declare them all
router.post("/", authMiddleware, adminMiddleware, upload.any(), createNewsLetter);

router.put("/:id", authMiddleware, adminMiddleware, upload.any(), updateNewsLetter);

router.delete("/:id", authMiddleware, adminMiddleware, deleteNewsLetter);
router.get("/category/:category", getNewsLettersByCategory);

module.exports = router;