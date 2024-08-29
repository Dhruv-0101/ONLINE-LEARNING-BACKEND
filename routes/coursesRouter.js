const express = require("express");
const courseController = require("../controllers/course");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const { isInstructor } = require("../middlewares/roleAccessMiddleware");

//course Router
const courseRouter = express.Router();

//create course
courseRouter.post(
  "/",
  isAuthenticated,
  isInstructor,
  courseController.createCourse
);
//get all courses
courseRouter.get("/", courseController.getAllCourses);
//update course
courseRouter.put("/:courseId", isInstructor, courseController.update);
//delete course
courseRouter.delete("/:courseId", isInstructor, courseController.delete);
//get a single course
courseRouter.get("/:courseId", courseController.getCourseById);
//check applied
courseRouter.post(
  "/checkinrolled",
  isAuthenticated,
  courseController.checkApplied
);
//check all course enrolled
courseRouter.post(
  "/checkallcourseinrolled",
  isAuthenticated,
  courseController.checkAllCoursesApplied
);

module.exports = courseRouter;
