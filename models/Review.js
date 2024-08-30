//Review Schema
const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ReviewSchema = new Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Review must belong to a user"],
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Review must belong to a course"],
    },
    message: {
      type: String,
      required: [true, "Please add a message"],
    },
    rating: {
      type: Number,
      required: [true, "Please add a rating between 1 and 5"],
      min: 1,
      max: 5,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Review", ReviewSchema);
