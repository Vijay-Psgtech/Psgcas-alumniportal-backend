const Newsletter = require("../models/Newsletter");
const fs = require("fs/promises");
const path = require("path");

const removeUploadedNewsletterFile = async (filePath) => {
  const normalizedPath = filePath?.replace(/\\/g, "/");
  const prefix = "uploads/newsletters/";
  if (!normalizedPath?.startsWith(prefix)) return;

  const root = path.resolve(__dirname, "..", "uploads", "newsletters");
  const target = path.resolve(root, normalizedPath.slice(prefix.length));
  if (!target.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid newsletter upload path");
  }

  try {
    await fs.unlink(target);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
};

const cleanupRequestFiles = async (files = []) => {
  await Promise.all(
    files.map(async (file) => {
      try {
        await removeUploadedNewsletterFile(file.path);
      } catch (error) {
        console.error("Could not remove unreferenced newsletter upload:", error);
      }
    }),
  );
};

exports.getAllNewsLetters = async (req, res) => {
  try {
    const newsletters = await Newsletter.find().sort( { date: -1 } );
    res.json({ success: true, data: newsletters });
  } catch (error) {
    console.error("Error fetching newsletters:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch newsletters" });
  }
};

// Get Recent 3 newsletters for homepage
exports.getRecentNewsLetters = async (req, res) => {
  try {
    const newsletters = await Newsletter.find().sort({ date: -1 }).limit(3);
    res.json({ success: true, data: newsletters });
  }
    catch (error) { 
    console.error("Error fetching recent newsletters:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch recent newsletters" });
  }
};

exports.getNewsLetterById = async (req, res) => {
  try {
    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      return res
        .status(404)
        .json({ success: false, message: "Newsletter not found" });
    }
    res.json({ success: true, data: newsletter });
  } catch (error) {
    console.error("Error fetching newsletter by ID:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch newsletter by ID" });
  }
};

exports.createNewsLetter = async (req, res) => {
  try {
    const {
      title,
      date,
      category,
      description,
      tags,
      author,
    } = req.body;

    // Validation
    if (!title || !date || !description) {
      await cleanupRequestFiles(req.files);
      return res.status(400).json({
        success: false,
        message: "Title, date, and description are required",
      });
    }

    const newNewsletter = new Newsletter({
      title,
      date,
      category: category || "Newsletters",
      description,
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
      author,
    });

    // ✅ FIXED v2: Handle files from req.files array (from upload.any())
    // upload.any() returns all files in req.files as an array
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        console.log(`📁 File received: ${file.fieldname} - ${file.originalname}`);
        
        if (file.fieldname === "imageUrl" && file.mimetype.startsWith("image/")) {
          newNewsletter.imageUrl = file.path;
          console.log(`✅ Image saved: ${file.path}`);
        } else if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
          newNewsletter.pdfUrl = file.path;
          console.log(`✅ PDF saved: ${file.path}`);
        }
      });
    }
    
    const savedNewsletter = await newNewsletter.save();
    
    res.status(201).json({ success: true, data: savedNewsletter });
  } catch (error) {
    await cleanupRequestFiles(req.files);
    console.error("Error creating newsletter:", error);
    res
      .status(500)
      .json({ 
        success: false, 
        message: "Failed to create newsletter",
        error: error.message 
      });
  }
};

exports.updateNewsLetter = async (req, res) => {
  try {
    const {
      title,
      date,
      category,
      description,
      tags,
      author,
    } = req.body;

    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      await cleanupRequestFiles(req.files);
      return res
        .status(404)
        .json({ success: false, message: "Newsletter not found" });
    }

    const previousFiles = {
      imageUrl: newsletter.imageUrl,
      pdfUrl: newsletter.pdfUrl,
    };

    newsletter.title = title ?? newsletter.title;
    newsletter.date = date ?? newsletter.date;
    newsletter.category = category ?? newsletter.category;
    newsletter.description = description ?? newsletter.description;
    newsletter.tags = Array.isArray(tags) ? tags : (tags ? [tags] : newsletter.tags || []);
    newsletter.author = author ?? newsletter.author;
    newsletter.updatedAt = new Date();

    // ✅ FIXED v2: Handle files from req.files array
    if (req.files && Array.isArray(req.files)) {
      req.files.forEach(file => {
        console.log(`📁 File received: ${file.fieldname} - ${file.originalname}`);
        
        if (file.fieldname === "imageUrl" && file.mimetype.startsWith("image/")) {
          newsletter.imageUrl = file.path;
          console.log(`✅ Image updated: ${file.path}`);
        } else if (file.fieldname === "pdf" && file.mimetype === "application/pdf") {
          newsletter.pdfUrl = file.path;
          console.log(`✅ PDF updated: ${file.path}`);
        }
      });
    }

    const updatedNewsletter = await newsletter.save();
<<<<<<< ours
=======
    try {
      if (previousFiles.imageUrl !== updatedNewsletter.imageUrl) {
        await removeUploadedNewsletterFile(previousFiles.imageUrl);
      }
      if (previousFiles.pdfUrl !== updatedNewsletter.pdfUrl) {
        await removeUploadedNewsletterFile(previousFiles.pdfUrl);
      }
    } catch (error) {
      console.error(
        "Newsletter updated, but a replaced upload could not be removed:",
        error,
      );
      return res.status(500).json({
        success: false,
        message: "Newsletter updated, but a replaced upload could not be removed",
      });
    }

    console.log("✅ Newsletter updated:", updatedNewsletter._id);
>>>>>>> theirs
    
    res.json({ success: true, data: updatedNewsletter });
  } catch (error) {
    await cleanupRequestFiles(req.files);
    console.error("Error updating newsletter:", error);
    res
      .status(500)
      .json({ 
        success: false, 
        message: "Failed to update newsletter",
        error: error.message 
      });
  }
};

exports.deleteNewsLetter = async (req, res) => {
  try {
    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      return res
        .status(404)
        .json({ success: false, message: "Newsletter not found" });
    }

    await Newsletter.findByIdAndDelete(req.params.id);
<<<<<<< ours
=======
    try {
      await Promise.all([
        removeUploadedNewsletterFile(newsletter.imageUrl),
        removeUploadedNewsletterFile(newsletter.pdfUrl),
      ]);
    } catch (error) {
      console.error("Newsletter deleted, but an upload could not be removed:", error);
      return res.status(500).json({
        success: false,
        message: "Newsletter deleted, but an upload could not be removed",
      });
    }

    console.log("✅ Newsletter deleted:", req.params.id);
>>>>>>> theirs
    
    res.json({ success: true, message: "Newsletter deleted successfully" });
  } catch (error) {
    console.error("Error deleting newsletter:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to delete newsletter" });
  }
};

exports.getNewsLettersByCategory = async (req, res) => {
  try {
    const category = req.params.category;
    const newsletters = await Newsletter.find({ category: category }).sort({
      date: -1,
    });
    res.json({ success: true, data: newsletters });
  } catch (error) {
    console.error("Error fetching newsletters by category:", error);
    res
      .status(500)
      .json({
        success: false,
        message: "Failed to fetch newsletters by category",
      });
  }
};