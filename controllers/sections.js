const mongoose = require("mongoose");
const asyncHandler = require("express-async-handler");
const CourseSection = require("../models/CourseSection");
const Course = require("../models/Course");
const cloudinary = require("../utils/cloudinaryConfig");
const Comment = require("../models/Comment");
const Question = require("../models/Question");
const Exam = require("../models/Exam");

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
  getAllSections: asyncHandler(async (req, res) => {
    const userId = req.user._id;

    if (!userId) {
      return res.status(400).json({ message: "User ID is required" });
    }

    let sections = await CourseSection.find({ createdBy: userId });

    res.json(sections);
  }),
  getSectionById: asyncHandler(async (req, res) => {
    const section = await CourseSection.findById(req.params.sectionId);
    if (section) {
      res.json(section);
    } else {
      res.status(404);
      throw new Error("Section not found");
    }
  }),
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
  delete: asyncHandler(async (req, res) => {
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
  addCommentToVideo: asyncHandler(async (req, res) => {
    const { videoId, commentText } = req.body;
    const userId = req.user._id;

    const courseSection = await CourseSection.findOne({
      "videos._id": videoId,
    });

    if (!courseSection) {
      return res.status(404).json({ message: "Video not found" });
    }

    const newComment = new Comment({
      user: userId,
      video: videoId,
      commentText: commentText,
    });

    const savedComment = await newComment.save();

    const video = courseSection.videos.id(videoId);
    video.comments.push(savedComment._id);

    await courseSection.save();

    res
      .status(201)
      .json({ message: "Comment added successfully", comment: savedComment });
  }),

  // getAllCommentsForVideo: asyncHandler(async (req, res) => {
  //   const { videoId } = req.params;

  //   const courseSection = await CourseSection.findOne({
  //     "videos._id": videoId,
  //   })
  //     .populate({
  //       path: "videos.comments",
  //       populate: { path: "user", select: "username" }, // Populate user information for comments
  //     })
  //     .populate({
  //       path: "videos.comments",
  //       populate: { path: "replies.user", select: "username" }, // Populate user information for replies
  //     });

  //   if (!courseSection) {
  //     return res.status(404).json({ error: "Video not found" });
  //   }

  //   const video = courseSection.videos.id(videoId);

  //   if (!video) {
  //     return res.status(404).json({ error: "Video not found" });
  //   }

  //   // Respond with the comments for the video
  //   res.status(200).json(video.comments);
  // }),
  getAllCommentsForVideo: asyncHandler(async (req, res) => {
    const { videoId } = req.params;

    const courseSection = await CourseSection.findOne({
      "videos._id": videoId,
    }).populate({
      path: "videos.comments",
      populate: [
        { path: "user", select: "username" },
        { path: "replies.user", select: "username" },
      ],
    });

    if (!courseSection) {
      return res.status(404).json({ error: "Video not found" });
    }

    const video = courseSection.videos.id(videoId);

    if (!video) {
      return res.status(404).json({ error: "Video not found" });
    }

    // Sort comments by createdAt descending (latest first)
    const sortedComments = [...video.comments].sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Sort replies inside each comment (optional)
    for (let comment of sortedComments) {
      comment.replies.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );
    }

    res.status(200).json(sortedComments);
  }),

  replyToComment: asyncHandler(async (req, res) => {
    const { commentId } = req.params;
    const { replyText } = req.body;
    const userId = req.user._id;

    const comment = await Comment.findById(commentId).populate(
      "user",
      "username"
    );

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    if (comment.user._id.toString() === userId.toString()) {
      throw new Error("You cannot reply to your own comment");
    }

    const reply = {
      replyText: replyText,
      user: userId,
      createdAt: new Date(),
    };

    comment.replies.push(reply);
    await comment.save();

    res.status(200).json(comment);
  }),

  createExam: asyncHandler(async (req, res) => {
    const { name, description, questions, sectionId, score, students } =
      req.body;

    if (!name || !description || !questions || !sectionId || !score) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const newExam = new Exam({
      name,
      description,
      sectionId,
      score,
      students,
      createdBy: req.user._id,
    });

    const savedExam = await newExam.save();

    const questionDocs = questions.map((q) => ({
      question: q.question,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      createdBy: req.user._id,
    }));

    // Create Question documents
    const savedQuestions = await Question.insertMany(questionDocs);

    // Update the exam with the created questions
    savedExam.questions = savedQuestions.map((q) => q._id);
    await savedExam.save();

    res.status(201).json({
      message: "Exam created successfully",
      exam: savedExam,
    });
  }),

  getExam: asyncHandler(async (req, res) => {
    const { sectionId } = req.params;

    const exams = await Exam.findOne({ sectionId }).populate({
      path: "questions",
      select: "question optionA optionB optionC optionD", // Customize the fields to return
    });
    // .exec();

    if (exams.length === 0) {
      return res
        .status(404)
        .json({ message: "No exams found for this section" });
    }

    res.json(exams);
  }),

  submitExam: asyncHandler(async (req, res) => {
    const { sectionId, answers } = req.body;
    const studentId = req.user._id;

    // Validate the input data
    if (!sectionId || !answers || !Array.isArray(answers)) {
      return res.status(400).json({ message: "Invalid input data" });
    }

    // Find the exam and populate its questions
    const exam = await Exam.findOne({ sectionId }).populate("questions");
    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Create a map of questions with their correct answers
    const correctAnswers = {};
    for (const question of exam.questions) {
      correctAnswers[question._id] = question.correctAnswer;
    }

    // Validate and check each answer
    let totalScore = 0;
    const studentAnswers = answers.map((answer) => {
      const correctAnswer = correctAnswers[answer.questionId];
      const isCorrect = correctAnswer === answer.selectedOption;
      if (isCorrect) {
        totalScore += 1; // Increment score for each correct answer
      }
      return {
        questionId: answer.questionId,
        selectedOption: answer.selectedOption,
        isCorrect,
      };
    });

    // Check if the student already exists in the students array
    const existingStudentIndex = exam.students.findIndex(
      (s) => s.studentId.toString() === studentId.toString()
    );

    if (existingStudentIndex !== -1) {
      // Update existing student's answers and score
      await Exam.findOneAndUpdate(
        { sectionId, "students.studentId": studentId },
        {
          $set: {
            "students.$.answers": studentAnswers,
            "students.$.score": totalScore,
          },
        },
        { new: true }
      );
    } else {
      // Add new student record with answers and score
      await Exam.findByIdAndUpdate(
        exam._id, // Use exam._id here instead of sectionId
        {
          $push: {
            students: {
              studentId,
              answers: studentAnswers,
              score: totalScore,
            },
          },
        },
        { new: true }
      );
    }

    res
      .status(200)
      .json({ message: "Exam submitted successfully", score: totalScore });
  }),

  revealExam: asyncHandler(async (req, res) => {
    const studentId = req.user._id.toString();
    const { sectionId } = req.params;

    // Find all exams that belong to the specified sectionId
    const exams = await Exam.find({
      sectionId: sectionId,
      "students.studentId": studentId,
    }).populate("questions");
    // .lean(); // Convert to plain JavaScript objects

    if (!exams.length) {
      return res
        .status(404)
        .json({ message: "No exams found for the student in this section" });
    }

    const formattedExams = exams.map((exam) => {
      const studentRecord = exam.students.find(
        (s) => s.studentId.toString() === studentId.toString()
      );

      const examDetails = {
        examId: exam._id,
        name: exam.name,
        description: exam.description,
        sectionId: exam.sectionId,
        score: studentRecord.score,
        answers: studentRecord.answers.map((studentAnswer) => {
          const question = exam.questions.find(
            (q) => q._id.toString() === studentAnswer.questionId.toString()
          );
          return {
            questionId: studentAnswer.questionId,
            questionText: question.text,
            correctAnswer: question.correctAnswer,
            selectedOption: studentAnswer.selectedOption,
            isCorrect: studentAnswer.isCorrect,
            question: question,
            options: {
              A: question.optionA,
              B: question.optionB,
              C: question.optionC,
              D: question.optionD,
            },
          };
        }),
      };

      return examDetails;
    });

    res
      .status(200)
      .json({ message: "Exams fetched successfully", exams: formattedExams });
  }),
};

module.exports = courseSectionsController;
