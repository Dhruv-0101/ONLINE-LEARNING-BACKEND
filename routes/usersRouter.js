const express = require("express");
const usersController = require("../controllers/users");
const { isAuthenticated } = require("../middlewares/isAuthenticated");

const usersRouter = express.Router();

// Register route
usersRouter.post("/register", usersController.register);
usersRouter.post("/registerInstructor", usersController.registerInstructor);

// user profile
usersRouter.get("/profile", isAuthenticated, usersController.profile);
usersRouter.post("/login", usersController.login);
// usersRouter.post("/logout", usersController.logoutUser);
usersRouter.get("/position/:courseId", usersController.getAllUsers);
//private profile
usersRouter.get(
  "/profile/private",
  isAuthenticated,
  usersController.privateProfile,
);
usersRouter.get(
  "/checkAuthenticated",
  isAuthenticated,
  usersController.checkAuthenticated,
);
usersRouter.post(
  "/addNotification",
  isAuthenticated,
  usersController.createCourseNotification,
);
usersRouter.get(
  "/getnotifications",
  isAuthenticated,
  usersController.getNotificationsByUserId,
);
// reactQuery/notifications/notificationsAPI.js
usersRouter.put(
  "/mark-as-read",
  isAuthenticated,
  usersController.markNotificationAsRead,
);
usersRouter.put(
  "/mark-all-as-read",
  isAuthenticated,
  usersController.markAllNotificationsAsRead,
);
usersRouter.post(
  "/register-passkey",
  isAuthenticated,
  usersController.registerUserPasskeyCtrl,
);
usersRouter.post(
  "/register-passkey-verify",
  isAuthenticated,
  usersController.registerPasskeyVerifyCtrl,
);
usersRouter.post(
  "/login-passkey",
  // isAuthenticated,
  usersController.loginUserPassKey,
);
usersRouter.post(
  "/login-passkey-verify",
  // isAuthenticated,
  usersController.loginPassKeyVerifyCtrl,
);

//logout
usersRouter.post("/logout", usersController.logout);
//get user by id
// usersRouter.get("/:id", usersController.getUserById);

module.exports = usersRouter;
