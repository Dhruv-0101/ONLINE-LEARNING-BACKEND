const bcrypt = require("bcryptjs");
const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const Course = require("../models/Course");
const Notification = require("../models/Notification");
const Challenge = require("../models/Challenge");
const {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} = require("@simplewebauthn/server");
const Buffer = require("buffer").Buffer;

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
      secure: process.env.NODE_ENV === "production", // Ensures the cookie is sent only over HTTPS in production
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
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
          (cp) => cp.courseId && cp.courseId._id.toString() === courseId,
        );
        console.log("courseProgress", courseProgress);

        if (!courseProgress) {
          return null;
        }

        const totalSections = courseProgress.courseId.sections.length;
        console.log(totalSections);
        const sectionsCompleted = courseProgress.sections.filter(
          (section) => section.status === "Completed",
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
          (p) => p.courseId?._id?.toString() === courseIdParam,
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
      user: {
        username: user.username,
        email: user.email,
        _id: user._id,
      },
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
      sameSite: "None",
      path: "/",
    });

    res.status(200).json({ message: "Logged out successfully" });
  }),
  createCourseNotification: asyncHandler(async (req, res) => {
    const { courseId, message } = req.body;

    if (!courseId || !message) {
      return res
        .status(400)
        .json({ message: "Course ID and message are required" });
    }

    const course = await Course.findById(courseId);

    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    const notificationMessage = `📢 ${message}`; // 👈 Add icon here

    // Loop through each student and create a notification
    const notifications = await Promise.all(
      course.students.map((studentId) =>
        Notification.create({
          userId: studentId,
          courseId: course._id,
          message: notificationMessage, // 👈 Save with icon
        }),
      ),
    );

    res.status(201).json({
      message: "Notifications sent to enrolled students",
      notifications,
    });
  }),

  getNotificationsByUserId: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    try {
      const notifications = await Notification.find({ userId }).sort({
        createdAt: -1,
      });

      res.status(200).json(notifications);
    } catch (error) {
      res.status(500).json({ message: "Failed to fetch notifications", error });
    }
  }),
  markNotificationAsRead: asyncHandler(async (req, res) => {
    try {
      const { notificationId } = req.body; // ✅ Destructure from req.body
      console.log("Notification ID:", notificationId.notificationId);

      const notification = await Notification.findById(
        notificationId.notificationId,
      );
      if (!notification) {
        return res.status(404).json({ message: "Notification not found" });
      }

      notification.isRead = true;
      await notification.save();

      res
        .status(200)
        .json({ message: "Notification marked as read", notification });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }),
  markAllNotificationsAsRead: asyncHandler(async (req, res) => {
    try {
      const userId = req.user._id;
      const result = await Notification.updateMany(
        { userId: userId, isRead: false },
        { $set: { isRead: true } },
      );

      res.status(200).json({
        message: "All notifications marked as read",
        count: result.modifiedCount,
      });
    } catch (error) {
      res.status(500).json({ message: "Server Error", error: error.message });
    }
  }),
  registerUserPasskeyCtrl: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    const challengePayload = await generateRegistrationOptions({
      rpID: "online-learning-frontend-seven.vercel.app",
      rpName: "Online Learning",
      userID: Buffer.from(user._id.toString()),
      userName: user.username,
      userDisplayName: user.username,
      attestationType: "none",
      timeout: 60000,
      authenticatorSelection: {
        residentKey: "required",
        userVerification: "required",
        authenticatorAttachment: "platform",
      },
    });

    // Clear any previous registration challenges for this user to avoid conflicts
    await Challenge.deleteMany({ userId, loginpasskey: false, passkey: null });

    await Challenge.create({
      userId,
      challenge: challengePayload.challenge,
      loginpasskey: false,
    });

    return res.json({ options: challengePayload });
  }),

  registerPasskeyVerifyCtrl: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const { cred } = req.body;

    const user = await User.findById(userId);
    if (!user) throw new Error("User not found");

    const challenge = await Challenge.findOne({
      userId,
      loginpasskey: false,
    }).sort({ createdAt: -1 });

    if (!challenge) throw new Error("Challenge not found");

    const verificationResult = await verifyRegistrationResponse({
      expectedChallenge: challenge.challenge,
      expectedOrigin: "https://online-learning-frontend-seven.vercel.app",
      expectedRPID: "online-learning-frontend-seven.vercel.app",
      response: cred,
    });

    if (!verificationResult.verified) {
      return res.json({ error: "Could not verify" });
    }

    const { registrationInfo } = verificationResult;

    // Defensive extraction of public key and ID
    const rawPublicKey =
      registrationInfo.credentialPublicKey ||
      (registrationInfo.credential && registrationInfo.credential.publicKey);
    const rawCredentialID =
      registrationInfo.credentialID ||
      (registrationInfo.credential && registrationInfo.credential.id);

    if (!rawPublicKey || !rawCredentialID) {
      return res.status(500).json({
        error: "Invalid registration info received from authenticator",
      });
    }

    const passkeyData = {
      credentialID: Buffer.from(rawCredentialID).toString("base64url"),
      publicKey: Buffer.from(rawPublicKey).toString("base64url"),
      counter: registrationInfo.counter ?? 0,
      fmt: registrationInfo.fmt,
      transports: cred.response.transports || [],
    };

    await Challenge.findByIdAndUpdate(challenge._id, {
      passkey: passkeyData,
    });

    res.json({ verified: true });
  }),

  loginUserPassKey: asyncHandler(async (req, res) => {
    const { username } = req.body;

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(404).json({ error: "User not found!" });
    }

    await Challenge.deleteMany({
      passkey: null,
    });

    const passkeys = await Challenge.find({
      userId: user._id,
      loginpasskey: false,
    });

    const opts = await generateAuthenticationOptions({
      rpID: "online-learning-frontend-seven.vercel.app",
      allowCredentials: passkeys.map((p) => ({
        id: p.passkey.credentialID,
        type: "public-key",
        transports: p.passkey.transports,
      })),
      userVerification: "required",
    });

    // Clean up old login challenges
    await Challenge.deleteMany({ userId: user._id, loginpasskey: true });

    await Challenge.create({
      userId: user._id,
      challenge: opts.challenge,
      loginpasskey: true,
    });

    return res.json({ options: opts });
  }),

  loginPassKeyVerifyCtrl: asyncHandler(async (req, res) => {
    const { username, cred } = req.body;

    const user = await User.findOne({ username });
    if (!user) return res.status(404).json({ error: "User not found!" });

    const challenge = await Challenge.findOne({
      userId: user._id,
      loginpasskey: true,
    });

    if (!challenge)
      return res.status(404).json({ error: "Challenge not found!" });

    await Challenge.deleteMany({
      passkey: null,
    });

    const passkeys = await Challenge.find({
      userId: user._id,
      loginpasskey: false,
    });

    if (!passkeys.length)
      return res.status(404).json({ error: "No passkey found!" });

    let verified = false;

    for (const item of passkeys) {
      const passkey = item.passkey;
      if (!passkey || !passkey.publicKey) continue;

      const publicKeyBuffer = Buffer.from(passkey.publicKey, "base64url");

      try {
        const result = await verifyAuthenticationResponse({
          expectedChallenge: challenge.challenge,
          expectedOrigin: "https://online-learning-frontend-seven.vercel.app",
          expectedRPID: "online-learning-frontend-seven.vercel.app",
          response: cred,
          credential: {
            id: passkey.credentialID,
            publicKey: publicKeyBuffer,
            counter: passkey.counter ?? 0,
          },
        });

        if (result.verified) {
          verified = true;

          // Update counter in DB to prevent replay attacks
          await Challenge.findByIdAndUpdate(item._id, {
            "passkey.counter": result.authenticationInfo.newCounter,
          });

          break;
        }
      } catch (err) {
        console.error("Verification error:", err);
      }
    }

    if (!verified) {
      return res.json({ error: "Authentication verification failed" });
    }

    const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, {
      expiresIn: "3d",
    });

    res.cookie("token", token, {
      httpOnly: true,
      secure: true,
      sameSite: "None",
      maxAge: 24 * 60 * 60 * 1000,
    });

    res.json({ success: true });
  }),
};

module.exports = usersController;
