const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventsById,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventsController");
const upload = require("../middleware/uploads");
const { authMiddleware, adminMiddleware } = require("../middleware/auth");

router.get("/", getAllEvents);
router.get("/:id", getEventsById);
router.post("/", authMiddleware, adminMiddleware, upload.single("imageUrl"), createEvent);
router.put("/:id", authMiddleware, adminMiddleware, upload.single("imageUrl"), updateEvent);
router.delete("/:id", authMiddleware, adminMiddleware, deleteEvent);

module.exports = router;
