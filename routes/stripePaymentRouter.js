// stripePaymentRouter.js
const express = require("express");
const { isAuthenticated } = require("../middlewares/isAuthenticated");
const stripePaymentController = require("../controllers/stripePaymentController");

const stripePaymentRouter = express.Router();

//-----Create payment----
stripePaymentRouter.post(
  "/checkout",
  isAuthenticated,
  stripePaymentController.payment
);

//----verify payment----
stripePaymentRouter.get("/verify/:paymentId", stripePaymentController.verify);

module.exports = stripePaymentRouter;
