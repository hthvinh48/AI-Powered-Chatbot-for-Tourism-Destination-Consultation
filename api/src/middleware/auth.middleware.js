const jwt = require("jsonwebtoken");
const prisma = require("../lib/prisma");

exports.authMiddleware = async (req, res, next) => {
  const token = req.header("Authorization")?.replace("Bearer ", "");
  if (!token) {
    return res.status(401).json({ message: "No token provided" });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);

    if (decoded.id) {
      // Always load role + ban state from DB for enforcement.
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { role: true, bannedAt: true },
      });

      if (!user) return res.status(401).json({ message: "Unauthorized" });
      if (user.bannedAt)
        return res.status(403).json({ message: "Account is banned" });

      decoded.role = user.role;
    }

    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ message: "Token expired or invalid" });
  }
};

exports.authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
