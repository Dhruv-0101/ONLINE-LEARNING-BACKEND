const mongoose = require("mongoose");

const noteSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Number,
      required: true, // in seconds
    },
    text: {
      type: String,
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "CourseSection",
      required: true,
    },
    videoId: {
      type: String, // store video._id as string
      required: true,
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

module.exports = mongoose.model("Note", noteSchema);
