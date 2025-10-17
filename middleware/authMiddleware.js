import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";

const jwt = require("jsonwebtoken");
const asyncHandler = require("express-async-handler");
const User = require("../models/userModel"); // Assuming you have a User model

const protectRoute = asyncHandler(async (req, res, next) => {
  let token;

  // 1. Check for token in both Authorization header and cookies for flexibility
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  } else if (req.cookies.token) {
    token = req.cookies.token;
  }

  if (token) {
    try {
      // 2. Verify the token
      const decodedToken = jwt.verify(token, process.env.JWT_SECRET);

      // 3. Find user but exclude the password field for security
      const user = await User.findById(decodedToken.userId).select("-password");

      // 4. CRITICAL: Check if the user still exists in the database
      if (!user) {
        return res.status(401).json({
          status: false,
          message: "Not authorized. User not found.",
        });
      }

      // 5. Attach the user object to the request
      req.user = user; // Now you have access to the full user object (e.g., req.user.name)

      next();
    } catch (error) {
      console.error(error);
      // More specific error message for different JWT errors can be useful for debugging
      let message = "Not authorized. Token failed.";
      if (error.name === 'TokenExpiredError') {
        message = "Not authorized. Token has expired.";
      }
      return res.status(401).json({ status: false, message });
    }
  } else {
    // No token was found at all
    return res
      .status(401)
      .json({ status: false, message: "Not authorized. No token provided." });
  }
});

const isAdminRoute = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(401).json({
      status: false,
      message: "Not authorized as admin. Try login as admin.",
    });
  }
};

export { isAdminRoute, protectRoute };
