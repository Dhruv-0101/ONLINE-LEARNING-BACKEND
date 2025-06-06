const mongoose = require("mongoose");

const challengeSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    challenge: {
      type: String,
      required: true,
    },
    loginpasskey: {
      type: Boolean,
      required: true,
    },
    passkey: {
      type: Object,
      default: null,
    },
  },
  {
    timestamps: true, // createdAt, updatedAt
  }
);

module.exports = mongoose.model("Challenge", challengeSchema);
