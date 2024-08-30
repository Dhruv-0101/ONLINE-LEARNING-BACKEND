const mongoose = require("mongoose");

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    description: String,
    difficulty: String,
    duration: String,
    sections: [{ type: mongoose.Schema.Types.ObjectId, ref: "CourseSection" }],
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    price: {
      type: Number,
      default: 0,
    },
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],
    communityLink: { type: String },
  },

  {
    timestamps: true,
    toJSON: { virtuals: true },
  }
);

//Total rating
courseSchema.virtual("totalReviews").get(function () {
  const course = this;
  return course?.reviews?.length;
});
//average Rating
courseSchema.virtual("averageRating").get(function () {
  let ratingsTotal = 0;
  const course = this;

  course?.reviews?.forEach((review) => {
    ratingsTotal += review?.rating;
  });

  const averageRating = parseFloat(
    (ratingsTotal / course?.reviews?.length).toFixed(1)
  );

  return averageRating;
});

const Course = mongoose.model("Course", courseSchema);

module.exports = Course;
