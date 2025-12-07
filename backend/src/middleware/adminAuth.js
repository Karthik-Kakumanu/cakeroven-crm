const jwt = require("jsonwebtoken");

module.exports = function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || "";

  if (!authHeader.startsWith("Bearer "))
    return res.status(401).json({ message: "Token missing" });

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.role !== "owner")
      return res.status(403).json({ message: "Not allowed" });

    req.admin = decoded;

    next();
  } catch (err) {
    console.error("Admin auth error:", err);
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
