import asyncHandler from "express-async-handler";
import jwt from "jsonwebtoken";
import User from "../models/userModel.js";
 
/**
* Middleware: Protect Routes
* Works with both Cookies and Bearer Token in Headers
*/
const protectRoute = asyncHandler(async (req, res, next) => {
  let token;
 
  // ✅ 1. First, check if token is in cookies
  if (req.cookies && req.cookies.token) {
    token = req.cookies.token;
  }
  // ✅ 2. If not in cookies, check in Authorization header
  else if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }
 
  // ✅ 3. If token is missing, block access
  if (!token) {
    return res.status(401).json({
      status: false,
      message: "Not authorized, token missing. Please login again.",
    });
  }
 
  try {
    // ✅ 4. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
 
    // ✅ 5. Fetch user details
    const user = await User.findById(decoded.userId).select("email isAdmin");
 
    if (!user) {
      return res.status(401).json({
        status: false,
        message: "User not found. Please login again.",
      });
    }
 
    // ✅ 6. Attach user to request for later use
    req.user = {
      userId: decoded.userId,
      email: user.email,
      isAdmin: user.isAdmin,
    };
 
    next();
  } catch (error) {
    console.error("Auth Error:", error);
    return res.status(401).json({
      status: false,
      message: "Not authorized, invalid or expired token. Please login again.",
    });
  }
});
 
/**
* Middleware: Admin Check
*/
const isAdminRoute = (req, res, next) => {
  if (req.user && req.user.isAdmin) {
    next();
  } else {
    return res.status(403).json({
      status: false,
      message: "Access denied. Admins only.",
    });
  }
};
 
export { protectRoute, isAdminRoute };
