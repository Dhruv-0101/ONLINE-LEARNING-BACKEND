const express = require("express");
const courseSectionsController = require("../controllers/sections");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isInstructor } = require("../middlewares/roleAccessMiddleware");
const upload = require("../middlewares/upload"); // Import multer middleware
const courseSection = express.Router();

courseSection.post(
  "/submit-exam",
  isAuthenticated,
  courseSectionsController.submitExam
);

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
courseSection.post(
  "/videos/comments",
  isAuthenticated,
  courseSectionsController.addCommentToVideo
);
courseSection.post(
  "/videos/getcomments/:videoId",
  isAuthenticated,
  courseSectionsController.getAllCommentsForVideo
);
courseSection.post(
  "/videos/comments/reply/:commentId",
  isAuthenticated,
  courseSectionsController.replyToComment
);
courseSection.post(
  "/create-exam/give-exam",
  isAuthenticated,
  isInstructor,
  courseSectionsController.createExam
);
courseSection.get(
  "/get-exam/:sectionId",
  isAuthenticated,
  courseSectionsController.getExam
);
// courseSection.post(
//   "/give-exam",
//   isAuthenticated,
//   courseSectionsController.submitExam
// );
courseSection.get(
  "/reveal-exam/:sectionId",
  isAuthenticated,
  courseSectionsController.revealExam
);

module.exports = courseSection;
