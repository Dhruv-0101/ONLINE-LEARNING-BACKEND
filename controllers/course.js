const asyncHandler = require("express-async-handler");

const Course = require("../models/Course");
const User = require("../models/User");
const Review = require("../models/Review");
const CourseSection = require("../models/CourseSection");
const Note = require("../models/Note");

const courseController = {
  createCourse: asyncHandler(async (req, res) => {
    const { title, description, difficulty, duration, communityLink, price } =
      req.body;
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
    if (!title || !description || !difficulty || !duration) {
      res.status(400);
      throw new Error("Please provide all required fields");
    }

    const courseFound = Course.findOne({ title });
    if (!courseFound) {
      res.status(400);
      throw new Error("Course already exists");
    }

    const course = await Course.create({
      title,
      description,
      difficulty,
      duration,
      communityLink,
      user: req.user._id,
      price,
    });
    userFound.coursesCreated.push(course._id);
    await userFound.save();

    if (course) {
      res.status(201).json(course);
    } else {
      res.status(400);
      throw new Error("Invalid course data");
    }
  }),
  getAllCourses: asyncHandler(async (req, res) => {
    const courses = await Course.find({})
      .populate({
        path: "user",
        model: "User",
        select: "username email",
      })
      .populate({
        path: "reviews",
        populate: {
          path: "user",
          model: "User",
          select: "username email",
        },
      });
    res.json(courses);
  }),
  getCourseById: asyncHandler(async (req, res) => {
    const course = await Course.findById(req.params.courseId)
      .populate({
        path: "sections",
        model: "CourseSection",
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
    const { courseId } = req.body;
    const studentId = req.user._id.toString();

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
  }),
  checkAllCoursesApplied: asyncHandler(async (req, res) => {
    const userId = req.user._id.toString();

    const courses = await Course.find({ students: userId });

    if (courses.length === 0) {
      throw new Error("no course found");
    }

    res.status(200).json(courses);
  }),
  createReview: asyncHandler(async (req, res) => {
    const { message, rating } = req.body;
    const { courseId } = req.params;

    // 1. Find the course and populate reviews
    const course = await Course.findById(courseId).populate("reviews");
    if (!course) {
      res.status(404);
      throw new Error("Course not found");
    }

    const userId = req?.user?._id;
    if (!userId) {
      res.status(400);
      throw new Error("User ID is required");
    }

    // 2. Check if user is enrolled in the course
    const isEnrolled = course?.students?.some(
      (studentId) => studentId?.toString() === userId.toString()
    );
    if (!isEnrolled) {
      res.status(403);
      throw new Error("Please enroll in the course before leaving a review");
    }

    // 3. Check if the user has already reviewed this course
    const hasReviewed = course?.reviews?.some(
      (review) => review?.user?.toString() === userId.toString()
    );
    if (hasReviewed) {
      res.status(400);
      throw new Error("You have already reviewed this course");
    }

    // 4. Create a new review
    const review = await Review.create({
      message,
      rating,
      course: course._id,
      user: userId,
    });

    // 5. Add review to the course
    course.reviews.push(review._id);
    await course.save();

    res.status(201).json({
      success: true,
      message: "Review created successfully",
    });
  }),
  addNotesToVideo: asyncHandler(async (req, res) => {
    try {
      const { sectionId, videoId } = req.params;
      const { timestamp, text } = req.body;
      const userId = req.user._id;

      // Validate input
      if (typeof timestamp !== "number" || !text || text.trim() === "") {
        return res
          .status(400)
          .json({ message: "Timestamp and text are required" });
      }

      // Check if course section exists
      const courseSection = await CourseSection.findById(sectionId);
      if (!courseSection) {
        return res.status(404).json({ message: "Course section not found" });
      }

      // Check if the videoId exists in the course section's videos array
      const video = courseSection.videos.id(videoId);
      if (!video) {
        return res
          .status(404)
          .json({ message: "Video not found in this section" });
      }

      // Create and save the note in the Note collection
      const newNote = await Note.create({
        timestamp,
        text,
        sectionId,
        videoId,
        createdBy: userId,
      });

      res.status(201).json({
        message: "Note added successfully",
        note: newNote,
      });
    } catch (error) {
      console.error("Error adding note:", error);
      res.status(500).json({ message: "Server error" });
    }
  }),
  fetchNotes: asyncHandler(async (req, res) => {
    try {
      const { sectionId, videoId } = req.params;
      const userId = req.user._id;

      // Find the course section
      const courseSection = await CourseSection.findById(sectionId);
      if (!courseSection) {
        return res.status(404).json({ message: "Course section not found" });
      }
      console.log("courseSection: ", courseSection);

      // Find the video by ID inside the section's videos array
      const video = courseSection.videos.id(videoId);
      if (!video) {
        return res
          .status(404)
          .json({ message: "Video not found in this section" });
      }

      // Fetch notes related to this video and user
      const notes = await Note.find({
        sectionId,
        videoId,
        createdBy: userId,
      }).sort({ timestamp: 1 }); // optional: sort notes by timestamp

      res.status(200).json({
        video,
        notes,
      });
    } catch (error) {
      console.error("Error fetching video and notes:", error);
      res.status(500).json({ message: "Server error" });
    }
  }),
};

module.exports = courseController;
