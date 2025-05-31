const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Course = require("../models/Course");

const usersController = {
  register: asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400);
      throw new Error("Please add all fields");
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error("User already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "student",
    });

    await newUser.save();
    if (newUser) {
      res.status(201).json({
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      });
    } else {
      res.status(400);
      throw new Error("Invalid user data");
    }
  }),
  registerInstructor: asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400);
      throw new Error("Please add all fields");
    }

    const userExists = await User.findOne({ email });
    if (userExists) {
      res.status(400);
      throw new Error("User already exists");
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
      role: "instructor",
    });

    await newUser.save();
    if (newUser) {
      res.status(201).json({
        _id: newUser.id,
        name: newUser.name,
        email: newUser.email,
      });
    } else {
      res.status(400);
      throw new Error("Invalid user data");
    }
  }),
  login: asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
      throw new Error("Invalid email or password");
    }

    const token = jwt.sign({ id: user?._id }, process.env.JWT_SECRET, {
      expiresIn: "30d", // Token expires in 30 days
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      _id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
    });
  }),
  getAllUsers: asyncHandler(async (req, res) => {
    const courseId = req.params.courseId;

    if (!mongoose.Types.ObjectId.isValid(courseId)) {
      return res.status(400).json({ message: "Invalid course ID" });
    }

    const users = await User.find({}).populate({
      path: "progress",
      populate: {
        path: "courseId",
        model: "Course",
        match: { _id: courseId },
        populate: {
          path: "sections",
          model: "CourseSection",
        },
      },
    });

    let userProgressData = users
      .map((user) => {
        const courseProgress = user.progress.find(
          (cp) => cp.courseId && cp.courseId._id.toString() === courseId
        );
        console.log("courseProgress", courseProgress);

        if (!courseProgress) {
          return null;
        }

        const totalSections = courseProgress.courseId.sections.length;
        console.log(totalSections);
        const sectionsCompleted = courseProgress.sections.filter(
          (section) => section.status === "Completed"
        ).length;
        const progressPercentage =
          totalSections > 0
            ? parseFloat(((sectionsCompleted / totalSections) * 100).toFixed(1))
            : 0;

        return {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          totalSections,
          sectionsCompleted,
          progressPercentage,
          position: null, // Position will be determined after sorting
          username: user.username,
          dateJoined: user?.createdAt,
        };
      })
      .filter((item) => item !== null); // Remove users without progress in the specified course

    // Sort users based on sectionsCompleted and assign positions
    // Sort users based on sectionsCompleted
    userProgressData.sort((a, b) => b.sectionsCompleted - a.sectionsCompleted);

    // Assign positions with dense ranking
    let lastRank = 0;
    let lastSectionsCompleted = -1;
    userProgressData.forEach((user) => {
      if (user.sectionsCompleted !== lastSectionsCompleted) {
        lastRank++;
        lastSectionsCompleted = user.sectionsCompleted;
      }
      user.position = `${lastRank}${
        ["st", "nd", "rd"][((((lastRank + 90) % 100) - 10) % 10) - 1] || "th"
      }`;
    });
    /*
    Example Walkthrough:
Suppose you have these users after sorting:

User A: Completed 5 sections
User B: Completed 5 sections
User C: Completed 3 sections
User D: Completed 2 sections
Here's how the ranking will be assigned:

Iteration 1 (User A):

Sections Completed = 5
Since lastSectionsCompleted = -1 (initial value), lastRank increments to 1.
Rank assigned: 1st
lastSectionsCompleted is updated to 5.
Iteration 2 (User B):

Sections Completed = 5
Since user.sectionsCompleted === lastSectionsCompleted (both are 5), the rank stays at 1.
Rank assigned: 1st
Iteration 3 (User C):

Sections Completed = 3
Since user.sectionsCompleted !== lastSectionsCompleted, lastRank increments to 2.
Rank assigned: 2nd
lastSectionsCompleted is updated to 3.
Iteration 4 (User D):

Sections Completed = 2
Since user.sectionsCompleted !== lastSectionsCompleted, lastRank increments to 3.
Rank assigned: 3rd
lastSectionsCompleted is updated to 2.
So, the final rankings are:

User A: 1st
User B: 1st
User C: 2nd
User D: 3rd*/

    res.json(userProgressData);
  }),
  getUserById: asyncHandler(async (req, res) => {
    const { id } = req.params;
    const user = await User.findById(id).populate({
      path: "progress",
      populate: {
        path: "courseId",
        model: "Course",
        populate: {
          path: "sections",
          model: "CourseSection",
        },
      },
    });
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    res.json(user);
  }),
  getUserProgress: asyncHandler(async (req, res) => {
    const { id } = req.user;
    const user = await User.findById(id).populate({
      path: "progress",
      populate: {
        path: "courseId",
        model: "Course",
        populate: {
          path: "sections",
          model: "CourseSection",
        },
      },
    });
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }
    res.json(user.progress);
  }),
  profile: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const courseIdParam = req.query.courseId;
    const user = await User.findById(userId).populate({
      path: "progress",
      populate: [
        {
          path: "courseId",
          model: "Course",
          populate: {
            path: "sections",
            model: "CourseSection",
          },
        },
        {
          path: "sections.sectionId",
          model: "CourseSection",
        },
      ],
    });
    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const courseProgress = courseIdParam
      ? user?.progress?.find(
          (p) => p.courseId?._id?.toString() === courseIdParam
        )
      : null;

    // If a specific course progress is found, calculate its summary
    let progressSummary = null;
    if (courseProgress) {
      const totalSections = courseProgress.courseId.sections?.length;
      let completed = 0,
        ongoing = 0,
        notStarted = 0;

      courseProgress.sections.forEach((section) => {
        if (section.status === "Completed") completed++;
        else if (section.status === "In Progress") ongoing++;
        else notStarted++;
      });

      progressSummary = {
        courseId: courseProgress.courseId._id,
        courseTitle: courseProgress.courseId.title,
        totalSections,
        completed,
        ongoing,
        notStarted,
      };
    }

    res.json({ user, courseProgress, progressSummary });
  }),
  privateProfile: asyncHandler(async (req, res) => {
    const { id } = req.user;
    const user = await User.findById(id).populate({
      path: "progress",
      populate: {
        path: "courseId",
        model: "Course",
        populate: {
          path: "sections",
          model: "CourseSection",
        },
      },
    });

    if (!user) {
      res.status(404);
      throw new Error("User not found");
    }

    const coursesProgress = user.progress.map((courseProgress) => {
      const totalSections = courseProgress.courseId.sections.length;
      let completed = 0,
        ongoing = 0,
        notStarted = 0;

      courseProgress.sections.forEach((section) => {
        if (section.status === "Completed") completed++;
        else if (section.status === "In Progress") ongoing++;
        else notStarted++;
      });

      return {
        courseId: courseProgress.courseId._id,
        courseTitle: courseProgress.courseId.title,
        totalSections,
        completed,
        ongoing,
        notStarted,
      };
    });

    const response = {
      totalCourses: user.progress.length,
      coursesProgress,
    };

    res.json(response);
  }),
  checkAuthenticated: asyncHandler(async (req, res) => {
    const token = req.cookies["token"];

    if (!token) {
      return res.status(401).json({ isAuthenticated: false });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const user = await User.findById(decoded.id).populate({
      path: "coursesCreated",
    });
    if (!user) {
      return res.status(401).json({ isAuthenticated: false });
    }
    return res.status(200).json({ isAuthenticated: true, user: user });
  }),
  logout: asyncHandler(async (req, res) => {
    res.clearCookie("token", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production", // Must match login
      sameSite: "strict",
    });
  
    res.status(200).json({ message: "Logged out successfully" });
  });
  
};

module.exports = usersController;
