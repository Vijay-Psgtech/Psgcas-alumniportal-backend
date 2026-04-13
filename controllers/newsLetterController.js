const Newsletter = require("../models/Newsletter");

exports.getAllNewsLetters = async (req, res) => {
  try {
    const newsletters = await Newsletter.find().sort({ createdAt: -1 });
    res.json({ success: true, data: newsletters });
  } catch (error) {
    console.error("Error fetching newsletters:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch newsletters" });
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
      imageUrl,
      pdfUrl,
      tags,
      author,
    } = req.body;
    if (!title || !date || !description) {
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
      tags,
      author,
    });

    // Handle file upload for imageUrl if provided
    if (req.file) {
      newNewsletter.imageUrl = req.file.path;
    }
    
    // Handle file upload for pdfUrl if provided
    if (req.files && req.files.pdf) {
        newNewsletter.pdfUrl = req.files.pdf[0].path;
    }
    
    const savedNewsletter = await newNewsletter.save();
    res.status(201).json({ success: true, data: savedNewsletter });
  } catch (error) {
    console.error("Error creating newsletter:", error);

    res
      .status(500)
      .json({ success: false, message: "Failed to create newsletter" });
  }
};

exports.updateNewsLetter = async (req, res) => {
  try {
    const {
      title,
      date,
      category,
      description,
      imageUrl,
      pdfUrl,
      tags,
      author,
    } = req.body;
    const newsletter = await Newsletter.findById(req.params.id);
    if (!newsletter) {
      return res
        .status(404)
        .json({ success: false, message: "Newsletter not found" });
    }
    newsletter.title = title ?? newsletter.title;
    newsletter.date = date ?? newsletter.date;
    newsletter.category = category ?? newsletter.category;
    newsletter.description = description ?? newsletter.description;
    newsletter.imageUrl = imageUrl ?? newsletter.imageUrl;
    newsletter.pdfUrl = pdfUrl ?? newsletter.pdfUrl;
    newsletter.tags = tags ?? newsletter.tags;
    newsletter.author = author ?? newsletter.author;
    newsletter.updatedAt = new Date();

    const updatedNewsletter = await newsletter.save();
    res.json({ success: true, data: updatedNewsletter });
  } catch (error) {
    console.error("Error updating newsletter:", error);
    res
      .status(500)
      .json({ success: false, message: "Failed to update newsletter" });
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

    await newsletter.remove();
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
