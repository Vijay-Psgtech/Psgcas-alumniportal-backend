const express = require("express");
const router = express.Router();
const { createDonations } = require("../controllers/donationController");

router.post("/", createDonations);