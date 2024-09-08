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

  addCommentToVideo: asyncHandler(async (req, res) => {
    const { videoId, commentText } = req.body;
    const userId = req.user._id;

    const courseSection = await CourseSection.findOne({
      "videos._id": videoId,
    });

    if (!courseSection) {
      return res.status(404).json({ message: "Video not found" });
    }

    // Create a new comment
    const newComment = new Comment({
      user: userId,
      video: videoId,
      commentText: commentText,
    });

    // Save the comment to the database
    const savedComment = await newComment.save();

    // Add the comment reference to the video's comments array
    const video = courseSection.videos.id(videoId);
    video.comments.push(savedComment._id);

    // Save the updated course section
    await courseSection.save();

    res
      .status(201)
      .json({ message: "Comment added successfully", comment: savedComment });
  }),

  getAllCommentsForVideo: asyncHandler(async (req, res) => {
    try {
      const { videoId } = req.params;

      // Find the course section that contains the video
      const courseSection = await CourseSection.findOne({
        "videos._id": videoId,
      })
        .populate({
          path: "videos.comments",
          populate: { path: "user", select: "username" }, // Populate user information for comments
        })
        .populate({
          path: "videos.comments",
          populate: { path: "replies.user", select: "username" }, // Populate user information for replies
        });

      if (!courseSection) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Find the specific video within the section
      const video = courseSection.videos.id(videoId);

      if (!video) {
        return res.status(404).json({ error: "Video not found" });
      }

      // Respond with the comments for the video
      res.status(200).json(video.comments);
    } catch (error) {
      console.error("Error fetching comments:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }),

  replyToComment: asyncHandler(async (req, res) => {
    const { commentId } = req.params; // ID of the comment being replied to
    const { replyText } = req.body; // The reply text
    console.log(replyText);
    const userId = req.user._id; // ID of the user replying

    // Find the comment being replied to
    const comment = await Comment.findById(commentId).populate(
      "user",
      "username"
    );

    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Check if the user is trying to reply to their own comment
    if (comment.user._id.toString() === userId.toString()) {
      // return res
      //   .status(401)
      //   .json({ error: "You cannot reply to your own comment" });
      throw new Error("You cannot reply to your own comment");
    }

    // Create a new reply object
    const reply = {
      replyText: replyText,
      user: userId, // Assuming userId is the ID of the user replying
      createdAt: new Date(),
    };

    // Add the reply to the comment's replies array
    comment.replies.push(reply);
    await comment.save();

    // Send the updated comment back as the response
    res.status(200).json(comment);
  }),

  createExam: asyncHandler(async (req, res) => {
    try {
      const { name, description, questions, sectionId, score, students } =
        req.body;

      // Validate required fields
      if (!name || !description || !questions || !sectionId || !score) {
        return res.status(400).json({ message: "All fields are required" });
      }

      // Create Exam document
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
        createdBy: req.user._id, // Assuming user ID is available from request
      }));

      // Create Question documents
      const savedQuestions = await Question.insertMany(questionDocs);

      // Update the exam with the created questions
      savedExam.questions = savedQuestions.map((q) => q._id);
      await savedExam.save();

      // Respond with the created exam
      res.status(201).json({
        message: "Exam created successfully",
        exam: savedExam,
      });
    } catch (error) {
      console.error("Error creating exam:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  }),

  getExam: asyncHandler(async (req, res) => {
    try {
      const { sectionId } = req.params;
      console.log(sectionId);

      // Find exams by sectionId and populate the questions
      const exams = await Exam.findOne({ sectionId }).populate({
        path: "questions",
        select: "question optionA optionB optionC optionD correctAnswer", // Customize the fields to return
      });
      // .exec();

      if (exams.length === 0) {
        return res
          .status(404)
          .json({ message: "No exams found for this section" });
      }

      res.json(exams);
    } catch (error) {
      console.error("Error fetching exams by sectionId:", error);
      res.status(500).json({ message: "Server error" });
    }
  }),

  submitExam: asyncHandler(async (req, res) => {
    const { sectionId, answers } = req.body;
    const studentId = req.user._id; // Ensure req.user is populated by authentication middleware

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

  // revealExam: asyncHandler(async (req, res) => {
  //   const studentId = req.user._id.toString(); // Ensure req.user is populated by authentication middleware
  //   const { sectionId } = req.params; // Assuming sectionId is passed as a parameter
  //   console.log("hiii", studentId);
  //   console.log("hello", sectionId);

  //   // Find all exams that belong to the specified sectionId
  //   const exams = await Exam.find({
  //     sectionId: sectionId,
  //     "students.studentId": studentId,
  //   })
  //     .populate("questions") // Populate questions for each exam
  //     // .lean(); // Convert to plain JavaScript objects

  //   console.log(exams);

  //   if (!exams.length) {
  //     return res
  //       .status(404)
  //       .json({ message: "No exams found for the student in this section" });
  //   }

  //   // Map over the exams and format the response
  //   const formattedExams = exams.map((exam) => {
  //     // Find the student's record in this exam
  //     const studentRecord = exam.students.find(
  //       (s) => s.studentId.toString() === studentId.toString()
  //     );

  //     // Map over the questions and include student's answers and correct answers
  //     const examDetails = {
  //       examId: exam._id,
  //       name: exam.name,
  //       description: exam.description,
  //       sectionId: exam.sectionId,
  //       score: studentRecord.score,
  //       answers: studentRecord.answers.map((studentAnswer) => {
  //         const question = exam.questions.find(
  //           (q) => q._id.toString() === studentAnswer.questionId.toString()
  //         );
  //         return {
  //           questionId: studentAnswer.questionId,
  //           questionText: question.text, // Adjust this to match your question schema
  //           correctAnswer: question.correctAnswer,
  //           selectedOption: studentAnswer.selectedOption,
  //           isCorrect: studentAnswer.isCorrect,
  //         };
  //       }),
  //     };

  //     return examDetails; // Accumulate the exam details in the formatted array
  //   });

  //   // Return the formatted exams
  //   res
  //     .status(200)
  //     .json({ message: "Exams fetched successfully", exams: formattedExams });
  // }),
  revealExam: asyncHandler(async (req, res) => {
    const studentId = req.user._id.toString(); // Ensure req.user is populated by authentication middleware
    const { sectionId } = req.params; // Assuming sectionId is passed as a parameter
    console.log("hiii", studentId);
    console.log("hello", sectionId);

    // Find all exams that belong to the specified sectionId
    const exams = await Exam.find({
      sectionId: sectionId,
      "students.studentId": studentId,
    }).populate("questions"); // Populate questions for each exam
    // .lean(); // Convert to plain JavaScript objects

    console.log(exams);

    if (!exams.length) {
      return res
        .status(404)
        .json({ message: "No exams found for the student in this section" });
    }

    // Map over the exams and format the response
    const formattedExams = exams.map((exam) => {
      // Find the student's record in this exam
      const studentRecord = exam.students.find(
        (s) => s.studentId.toString() === studentId.toString()
      );

      // Map over the questions and include student's answers and correct answers
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
            questionText: question.text, // Adjust this to match your question schema
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

      return examDetails; // Accumulate the exam details in the formatted array
    });

    // Return the formatted exams
    res
      .status(200)
      .json({ message: "Exams fetched successfully", exams: formattedExams });
  }),
};

module.exports = courseSectionsController;
