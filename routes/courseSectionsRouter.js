const express = require("express");
const courseSectionsController = require("../controllers/sections");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isInstructor } = require("../middlewares/roleAccessMiddleware");
const upload = require("../middlewares/upload"); // Import multer middleware
const courseSection = express.Router();

courseSection.post(
  "/:courseId",
  isAuthenticated,
  isInstructor,
  upload,
  courseSectionsController.createSection
);
//get all courses
courseSection.get(
  "/",
  isAuthenticated,
  courseSectionsController.getAllSections
);

//get a single course
courseSection.get("/:sectionId", courseSectionsController.getSectionById);

//update course
courseSection.put("/:sectionId", courseSectionsController.update);
//delete course
courseSection.delete(
  "/:sectionId",
  isInstructor,
  courseSectionsController.delete
);

module.exports = courseSection;
