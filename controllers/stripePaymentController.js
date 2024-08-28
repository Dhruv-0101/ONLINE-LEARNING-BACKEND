const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const asyncHandler = require("express-async-handler");
const mongoose = require("mongoose");
const Course = require("../models/Course");
const User = require("../models/User");
const Payment = require("../models/Payment");
//-----Stripe Payment-----
const stripePaymentController = {
  //----- payment
  payment: asyncHandler(async (req, res) => {
    //!. Get the plan ID
    const { courseId } = req.body;
    console.log("courseId", courseId);
    //!. Check for the valid id of the plan
    if (!mongoose.isValidObjectId(courseId)) {
      return res.json({ message: "Invalid subscription plan" });
    }
    //! Find the plan
    const course = await Course.findById(courseId);
    if (!course) {
      return res.json({ message: "course not found" });
    }
    console.log("course", course);

    //! get the user
    const user = req.user._id;
    console.log("user", user);

    const userFound = await User.findById(user);
    if (!userFound) {
      return res.json({ message: "User not found" });
    }
    console.log("userFound", userFound);

    // Check if the user is already enrolled in the course
    const isAlreadyEnrolled = userFound.progress.some(
      (progress) => progress.courseId.toString() === courseId
    );

    if (isAlreadyEnrolled) {
      return res
        .status(400)
        .json({ message: "You have already enrolled in this course" });
    }
    //! Create payment intent/making the payment
    try {
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
        // add some metadata
        metadata: {
          userId: user?.toString(),
          courseId,
        },
      });
      //! Send the response
      res.json({
        clientSecret: paymentIntent.client_secret,
        courseId,
        paymentIntent,
      });
    } catch (error) {
      res.json({ error });
    }
  }),
  //verifying the payment
  verify: asyncHandler(async (req, res) => {
    //! Get the paymentId
    const { paymentId } = req.params;
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentId);
    console.log(paymentIntent);
    //! confirm the payment status
    if (paymentIntent.status === "succeeded") {
      //!get the data from the metadata
      const metadata = paymentIntent?.metadata;
      const courseId = metadata?.courseId;
      const userId = metadata.userId;
      //! Find the user
      const userFound = await User.findById(userId);
      if (!userFound) {
        return res.json({ message: "User not found" });
      }
      const courseIdFound = await Course.findById(courseId);
      if (!courseIdFound) {
        return res.json({ message: "User not found" });
      }
      //! Get the payment details
      const amount = paymentIntent?.amount / 100;
      const currency = paymentIntent?.currency;
      // ! Create payment History
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
        //push the user to the course
        courseIdFound.students.push(userId);
        await courseIdFound.save({
          validateBeforeSave: false,
        });
      }
      //! Send the response
      res.json({
        status: true,
        message: "Payment verified, user updated",
        userFound,
      });
    }
  }),
  //Free plan
  // free: asyncHandler(async (req, res) => {
  //   //check for the user
  //   const user = await User.findById(req.user);
  //   if (!user) {
  //     throw new Error("User not found");
  //   }
  //   //update the user field
  //   user.hasSelectedPlan = true;
  //   await user.save();
  //   //send the response
  //   res.json({
  //     status: true,
  //     message: "Payment verified, user updated",
  //   });
  // }),
};

module.exports = stripePaymentController;
