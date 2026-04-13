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

router.get("/", getAllNewsLetters);
router.get("/:id", getNewsLetterById);
router.post("/", upload.single("imageUrl"), createNewsLetter);
router.put("/:id", upload.single("imageUrl"), updateNewsLetter);
router.delete("/:id", deleteNewsLetter);
router.get("/category/:category", getNewsLettersByCategory);

module.exports = router;

    