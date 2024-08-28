const asyncHandler = require("express-async-handler");

const Course = require("../models/Course");
const User = require("../models/User");

const courseController = {
  // Create a new course
  createCourse: asyncHandler(async (req, res) => {
    const { title, description, difficulty, duration } = req.body;
    //find the user
    const userFound = await User.findById(req.user._id);
    if (!userFound) {
      res.status(404);
      throw new Error("User not found");
    }
    if (userFound?.role !== "instructor") {
      res.status(404);
      throw new Error(
        "You are not authorized to create a course, instructors only"
      );
    }
    //Validate course input
    if (!title || !description || !difficulty || !duration) {
      res.status(400);
      throw new Error("Please provide all required fields");
    }

    // Check if course already exists

    const courseFound = Course.findOne({ title });
    if (!courseFound) {
      res.status(400);
      throw new Error("Course already exists");
    }

    // Create course
    const course = await Course.create({
      title,
      description,
      difficulty,
      duration,
      user: req.user._id,
    });
    //push course into user courses
    userFound.coursesCreated.push(course._id);
    await userFound.save();

    if (course) {
      res.status(201).json(course);
    } else {
      res.status(400);
      throw new Error("Invalid course data");
    }
  }),
  // Get all courses
  getAllCourses: asyncHandler(async (req, res) => {
    const courses = await Course.find({}).populate({
      path: "user",
      model: "User",
      select: "username email",
    });
    res.json(courses);
  }),
  // Get a single course
  getCourseById: asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId)
      .populate({
        path: "sections",
        model: "CourseSection",
        populate: {
          path: "videos", // Ensure that this field is populated, even though it's embedded.
          model: "Video", // Optional: If you had a separate model for videos, but in this case, it's embedded.
        },
      })
      .populate({
        path: "user",

        model: "User",
      });
    if (course) {
      res.json(course);
    } else {
      res.status(404);
      throw new Error("Course not found");
    }
  }),
  //update course using mongoose method findByIdAndUpdate
  update: asyncHandler(async (req, res) => {
    const course = await Course.findByIdAndUpdate(
      req.params.courseId,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (course) {
      res.json(course);
    } else {
      res.status(404);
      throw new Error("Course not found");
    }
  }),
  //delete course using mongoose method findByIdAndDelete
  delete: asyncHandler(async (req, res) => {
    //check if a course has students
    const courseFound = await Course.findById(req.params.courseId);

    if (courseFound.students.length > 0) {
      res.status(400);
      throw new Error("Course has students, cannot delete");
    }
    const course = await Course.findByIdAndDelete(req.params.courseId);
    if (course) {
      res.json(course);
    } else {
      res.status(404);
      throw new Error("Course not found");
    }
  }),

  checkApplied: asyncHandler(async (req, res) => {
    try {
      const { courseId } = req.body; // Ensure courseId is extracted properly
      const studentId = req.user._id.toString(); // Convert studentId to string
      console.log(courseId);
      // Validate courseId format
      // if (!mongoose.Types.ObjectId.isValid(courseId)) {
      //   return res.status(400).json({ message: "Invalid course ID" });
      // }

      // Find the course by ID
      const course = await Course.findById(courseId);

      if (!course) {
        return res.status(404).json({ message: "Course not found" });
      }

      // Check if studentId is in the students array
      const isEnrolled = course.students.includes(studentId);

      return res.status(200).json({
        isEnrolled,
        message: isEnrolled
          ? "Student is already enrolled"
          : "Student is not enrolled",
      });
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Server error" });
    }
  }),
};

module.exports = courseController;
