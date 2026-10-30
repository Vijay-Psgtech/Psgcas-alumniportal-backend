const Event = require("../models/Events");
const fs = require("fs/promises");
const path = require("path");

const removeUploadedEventImage = async (imagePath) => {
  const normalizedPath = imagePath?.replace(/\\/g, "/");
  const prefix = "uploads/events/";
  if (!normalizedPath?.startsWith(prefix)) return;

  const root = path.resolve(__dirname, "..", "uploads", "events");
  const target = path.resolve(root, normalizedPath.slice(prefix.length));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid event image path");
  }

  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const cleanupRequestImage = async (req) => {
  if (!req.file?.path) return;
  try {
    await removeUploadedEventImage(req.file.path);
  } catch (error) {
    console.error("Could not remove unreferenced event image:", error);
  }
};

exports.getAllEvents = async (req, res) => {
  try {
    const { status, category } = req.query;
    let query = {};
    if (status) {
      query.status = { $regex: new RegExp(`^${status}$`, "i") };
    }
    if (category) {
      query.category = { $regex: new RegExp(`^${category}$`, "i") };
    }
    const events = await Event.find(query).sort({ createdAt: -1 });

   res.json({
      success: true,
      data: events,
    });

  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch events",
    });
  }
};


exports.getEventsById = async (req, res) => {
  try {
    const event = await Event.findById(req.params.id);
    if (!event)
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    res.json({ success: true, data: event });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch events by Id" });
  }
};

exports.createEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      venue,
      description,
      status,
      attendees,
      category,
      highlight,
    } = req.body;

    if (!title || !date || !venue) {
      await cleanupRequestImage(req);
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });
    }

    const newEvent = new Event({
      title,
      date,
      time,
      venue,
      description,
      status: status || "upcoming",
      attendees: Number(attendees) || 0,
      category: category || "Other",
      highlight: highlight || false,
      tags: [category],
      longDescription: description,
      speakers: [],
      schedule: [],
      highlights: [],
    });

    if (req.file) {
      newEvent.imageUrl = req.file.path.replace(/\\/g, "/");
    }

    const savedEvent = await newEvent.save();
    res.status(201).json({ success: true, data: savedEvent });
  } catch (error) {
    await cleanupRequestImage(req);
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: "Failed to create event" });
  }
};

exports.updateEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      time,
      venue,
      description,
      status,
      attendees,
      category,
      highlight,
      tags,
      speakers,
      schedule,
      highlights,
    } = req.body;

    const updateData = {
      title,
      date,
      time,
      venue,
      description,
      status,
      attendees: Number(attendees) || 0,
      category,
      highlight,
      tags: tags || [category],
      longDescription: description,
      speakers: speakers || [],
      schedule: schedule || [],
      highlights: highlights || [],
      updatedAt: new Date(),
    };

    if (req.file) {
      updateData.imageUrl = req.file.path.replace(/\\/g, "/");
    }

    const event = await Event.findById(req.params.id);

    if (!event) {
      await cleanupRequestImage(req);
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    const previousImage = event.imageUrl;
    Object.assign(event, updateData);
    if (req.file) {
      event.imageUrl = req.file.path.replace(/\\/g, "/");
    }

    const updatedEvent = await event.save();
    if (req.file && previousImage !== updatedEvent.imageUrl) {
      try {
        await removeUploadedEventImage(previousImage);
      } catch (error) {
        console.error("Event updated, but the replaced image could not be removed:", error);
        return res.status(500).json({
          success: false,
          message: "Event updated, but the replaced image could not be removed",
        });
      }
    }

    return res.json({ success: true, data: updatedEvent });
  } catch (error) {
    await cleanupRequestImage(req);
    console.error("Error updating event:", error);
    res.status(500).json({ success: false, message: "Failed to update event" });
  }
};

exports.deleteEvent = async (req, res) => {
  try {
    const deletedEvent = await Event.findById(req.params.id);

    if (!deletedEvent) {
      return res
        .status(404)
        .json({ success: false, message: "Event not found" });
    }

    await deletedEvent.deleteOne();
    try {
      await removeUploadedEventImage(deletedEvent.imageUrl);
    } catch (error) {
      console.error("Event deleted, but its image could not be removed:", error);
      return res.status(500).json({
        success: false,
        message: "Event deleted, but its image could not be removed",
      });
    }

    res.json({ success: true, message: "Event deleted successfully" });
  } catch (error) {
    console.error("Error deleting event:", error);
    res.status(500).json({ success: false, message: "Failed to delete event" });
  }
};
