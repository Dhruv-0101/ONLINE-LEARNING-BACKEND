const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const User = require("../models/User");
const Payment = require("../models/Payment");
const stripePaymentController = {
  payment: asyncHandler(async (req, res) => {
    const { courseId } = req.body;

    if (!mongoose.isValidObjectId(courseId)) {
      return res.json({ message: "Invalid subscription plan" });
    }
    const course = await Course.findById(courseId);
    if (!course) {
      return res.json({ message: "course not found" });
    }
    console.log("course", course);

    const user = req.user._id;
    console.log("user", user);

    const userFound = await User.findById(user);
    if (!userFound) {
      return res.json({ message: "User not found" });
    }
    console.log("userFound", userFound);

    const isAlreadyEnrolled = userFound.progress.some(
      (progress) => progress.courseId.toString() === courseId
    );

    if (isAlreadyEnrolled) {
      return res
        .status(400)
        .json({ message: "You have already enrolled in this course" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: course.price * 100,
      currency: "usd",
      description: "for learning project",
      shipping: {
        name: "Dummy",
        address: {
          line1: "510 Townsend St",
          postal_code: "98140",
          city: "San Francisco",
          state: "CA",
          country: "US",
        },
      },
      metadata: {
        userId: user?.toString(),
        courseId,
      },
    });
    res.json({
      clientSecret: paymentIntent.client_secret,
      courseId,
      paymentIntent,
    });
  }),
  verify: asyncHandler(async (req, res) => {
    const { paymentId } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);

    if (paymentIntent.status === "succeeded") {
      const metadata = paymentIntent?.metadata;
      const courseId = metadata?.courseId;
      const userId = metadata.userId;
      const userFound = await User.findById(userId);
      if (!userFound) {
        return res.json({ message: "User not found" });
      }
      const courseIdFound = await Course.findById(courseId);
      if (!courseIdFound) {
        return res.json({ message: "User not found" });
      }
      const amount = paymentIntent?.amount / 100;
      const currency = paymentIntent?.currency;
      const newPayment = await Payment.create({
        user: userId,
        courseId: courseId,
        status: "success",
        amount,
        currency,
        reference: paymentId,
      });

      if (newPayment) {
        userFound.progress.push({ courseId: courseIdFound, sections: [] });
        await userFound.save({
          validateBeforeSave: false,
        });
        courseIdFound.students.push(userId);
        await courseIdFound.save({
          validateBeforeSave: false,
        });
      }
      res.json({
        status: true,
        message: "Payment verified, user updated",
        userFound,
      });
    }
  }),
};

module.exports = stripePaymentController;
