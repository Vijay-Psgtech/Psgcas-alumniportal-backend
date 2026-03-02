const express = require("express");
const router = express.Router();
const {
  getAllEvents,
  getEventsById,
  createEvent,
  updateEvent,
  deleteEvent,
} = require("../controllers/eventsController");

router.get("/", getAllEvents);
router.get("/:id", getEventsById);
router.post("/", createEvent);
router.put("/:id", updateEvent);
router.delete("/:id", deleteEvent);

module.exports = router;
