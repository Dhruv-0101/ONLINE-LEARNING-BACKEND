const asyncHandler = require("express-async-handler");
const User = require("../models/User");
const Course = require("../models/Course");

const progressController = {
  startSection: asyncHandler(async (req, res) => {
    const { courseId, sectionId } = req.body;
    const userId = req.user._id;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const courseProgress = user.progress.find(
      (p) => p.courseId.toString() === courseId
    );
    if (!courseProgress) {
      return res
        .status(404)
        .json({ message: "Course not found in user's progress" });
    }

    const existingSection = courseProgress.sections.find(
      (s) => s.sectionId.toString() === sectionId
    );
    if (existingSection) {
      return res.status(400).json({ message: "Section already started" });
    }

    courseProgress.sections.push({
      sectionId: sectionId,
      status: "Not Started",
    });

    await user.save({
      validateBeforeSave: false,
    });
    res.status(200).json({ message: "Section started successfully" });
  }),
  updateSectionProgress: asyncHandler(async (req, res) => {
    const { courseId, sectionId, newStatus } = req.body;
    const userId = req.user._id;
    const user = await User.findOne({
      _id: userId,
      "progress.courseId": courseId,
    });
    if (!user) {
      return res.status(404).json({ message: "User or course not found" });
    }

    const courseProgress = user.progress.find((p) => {
      return p.courseId.toString() === courseId;
    });
    console.log("courseProgress",courseProgress);

    const sectionProgress = courseProgress.sections.find(
      (s) => s.sectionId.toString() === sectionId
    );
    console.log("sectionProgress",sectionProgress)
    if (sectionProgress) {
      sectionProgress.status = newStatus;
    } else {
      return res
        .status(404)
        .json({ message: "Section not found in user's progress" });
    }

    await user.save({
      validateBeforeSave: false,
    });
    res.status(200).json({ message: "Section progress updated successfully" });
  }),
  getUserProgress: asyncHandler(async (req, res) => {
    const userId = req.user._id;
    const user = await User.findById(userId).populate(
      "progress.courseId progress.sectionId progress.lectureId"
    );
    if (!user) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    res.status(200).json(user.progress);
  }),
};

module.exports = progressController;
