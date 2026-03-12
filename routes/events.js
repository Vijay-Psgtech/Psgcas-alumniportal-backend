const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventsById,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventsController");
const upload   = require("../middleware/uploads");

router.get("/", getAllEvents);
router.get("/:id", getEventsById);
router.post("/", upload.single("image"), createEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
