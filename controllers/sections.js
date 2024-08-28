const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const CourseSection = require("../models/CourseSection");
const Course = require("../models/Course");
const cloudinary = require("../utils/cloudinaryConfig");

const uploadVideos = async (files) => {
  const uploadPromises = files.map((file) =>
    cloudinary.uploader.upload(file.path, {
      resource_type: "video",
      folder: "course_videos",
    })
  );
  return Promise.all(uploadPromises);
};
const courseSectionsController = {
  createSection: asyncHandler(async (req, res) => {
    const { sectionName } = req.body;
    const titles = req.body.titles || [];
    const { courseId } = req.params;

    // Validate sectionName
    if (!sectionName) {
      return res.status(400).json({ message: "Please provide section name" });
    }

    // Check for authenticated user
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User not found" });
    }

    // Find the course
    const course = await Course.findById(courseId);
    if (!course) {
      return res.status(404).json({ message: "Course not found" });
    }

    // Create a new section
    const section = new CourseSection({
      sectionName,
      createdBy: userId,
    });

    // Handle video files
    if (req.files && req.files.length > 0) {
      try {
        if (titles.length !== req.files.length) {
          return res.status(400).json({
            message: "The number of titles must match the number of videos",
          });
        }

        const uploadedVideos = await uploadVideos(req.files);

        section.videos = uploadedVideos.map((result, index) => {
          const title = titles[index];
          if (!title) {
            throw new Error(`Title for video ${index + 1} is required`);
          }
          return {
            title,
            url: result.secure_url,
            public_id: result.public_id,
          };
        });

        // Validate video URLs and public IDs
        section.videos.forEach((video) => {
          if (!video.url || !video.public_id) {
            throw new Error("Video URL or public ID is missing");
          }
        });
      } catch (error) {
        return res.status(500).json({
          message: "Video upload failed",
          error: error.message,
        });
      }
    } else {
      return res
        .status(400)
        .json({ message: "Please upload at least one video" });
    }

    // Save the section and update the course
    await section.save();
    course.sections.push(section._id);
    await course.save();

    res.status(201).json({
      status: "success",
      data: section,
      message: "Section created successfully",
    });
  }),
  //get all sections
  getAllSections: asyncHandler(async (req, res) => {
    // const sections = await CourseSection.find({});
    // res.json(sections);
    try {
      const userId = req.user._id;

      // Ensure userId is provided
      if (!userId) {
        return res.status(400).json({ message: "User ID is required" });
      }

      // Find sections created by the specified user
      let sections = await CourseSection.find({ createdBy: userId });

      // Respond with the filtered sections
      res.json(sections);
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }),
  // Get a single section
  getSectionById: asyncHandler(async (req, res) => {
    const section = await CourseSection.findById(req.params.sectionId);
    if (section) {
      res.json(section);
    } else {
      res.status(404);
      throw new Error("Section not found");
    }
  }),
  //update section using mongoose method findByIdAndUpdate
  update: asyncHandler(async (req, res) => {
    const section = await CourseSection.findByIdAndUpdate(
      req.params.sectionId,
      req.body,
      {
        new: true,
        runValidators: true,
      }
    );
    if (section) {
      res.json(section);
    } else {
      res.status(404);
      throw new Error("Section not found");
    }
  }),
  //delete section
  delete: asyncHandler(async (req, res) => {
    //find section

    const foundSection = await CourseSection.findById(req.params.sectionId);
    if (!foundSection) {
      res.status(404);
      throw new Error("Section not found");
    }

    res.status(404);
    throw new Error(
      "Section cannot be deleted because it's associated with a course. you can only update it"
    );
  }),
};

module.exports = courseSectionsController;
