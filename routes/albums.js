// backend/routes/albums.js
const express = require("express");
const router = express.Router();
const Album = require("../models/Album");

// ── GET all albums (grouped by year) ────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const albums = await Album.find().sort({ year: -1, date: -1 });

    // Group by year
    const grouped = albums.reduce((acc, album) => {
      const year = album.year;
      if (!acc[year]) {
        acc[year] = {
          year,
          coverColor: "#667eea",
          totalPhotos: 0,
          totalEvents: 0,
          albums: [],
        };
      }
      acc[year].albums.push(album);
      acc[year].totalPhotos += album.photos;
      acc[year].totalEvents = acc[year].albums.length;
      return acc;
    }, {});

    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error("Error fetching albums:", error);
    res.status(500).json({ success: false, message: "Failed to fetch albums" });
  }
});

// ── GET albums for a specific year ──────────────────────────────────
router.get("/year/:year", async (req, res) => {
  try {
    const year = Number(req.params.year);
    const albums = await Album.find({ year }).sort({ date: -1 });

    const yearData = {
      year,
      coverColor: "#667eea",
      totalPhotos: albums.reduce((s, a) => s + a.photos, 0),
      totalEvents: albums.length,
      albums,
    };

    res.json({ success: true, data: yearData });
  } catch (error) {
    res.status(500).json({ success: false, message: "Failed to fetch year albums" });
  }
});

// ── CREATE new album ────────────────────────────────────────────────
router.post("/", async (req, res) => {
  try {
    const { year, title, event, date, photos, accent, tags } = req.body;

    if (!year || !title || !event) {
      return res.status(400).json({ success: false, message: "Missing required fields" });
    }

    const newAlbum = new Album({
      year: Number(year),
      id: `album-${Date.now()}`,
      title,
      event,
      date,
      photos: Number(photos) || 0,
      accent: accent || "#b8882a",
      tags: tags || [event],
    });

    const savedAlbum = await newAlbum.save();
    res.status(201).json({ success: true, data: savedAlbum });
  } catch (error) {
    console.error("Error creating album:", error);
    res.status(500).json({ success: false, message: "Failed to create album" });
  }
});

// ── UPDATE album ────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const { title, event, date, photos, accent, tags } = req.body;

    const updateData = {
      title,
      event,
      date,
      photos: Number(photos) || 0,
      accent,
      tags,
      updatedAt: new Date(),
    };

    const updatedAlbum = await Album.findByIdAndUpdate(req.params.id, updateData, { new: true });

    if (!updatedAlbum) {
      return res.status(404).json({ success: false, message: "Album not found" });
    }

    res.json({ success: true, data: updatedAlbum });
  } catch (error) {
    console.error("Error updating album:", error);
    res.status(500).json({ success: false, message: "Failed to update album" });
  }
});

// ── DELETE album ────────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const deletedAlbum = await Album.findByIdAndDelete(req.params.id);

    if (!deletedAlbum) {
      return res.status(404).json({ success: false, message: "Album not found" });
    }

    res.json({ success: true, message: "Album deleted successfully" });
  } catch (error) {
    console.error("Error deleting album:", error);
    res.status(500).json({ success: false, message: "Failed to delete album" });
  }
});

module.exports = router;