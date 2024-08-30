const mongoose = require("mongoose");

const sectionSchema = new mongoose.Schema(
  {
    sectionName: { type: String, required: true },

    sectionsCompleted: [
      {
        section: { type: mongoose.Schema.Types.ObjectId, ref: "CourseSection" },
        completed: Boolean,
      },
    ],
    videos: [
      {
        title: {
          type: String,
          required: true,
        },
        url: {
          type: String,
          required: true,
        },
        public_id: {
          type: String,
          required: true,
        },
        comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
      },
    ],
    estimatedTime: Number,
    isCompleted: {
      type: Boolean,
      default: false,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("CourseSection", sectionSchema);
