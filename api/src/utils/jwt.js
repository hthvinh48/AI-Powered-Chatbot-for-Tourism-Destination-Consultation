const jwt = require("jsonwebtoken");
const crypto = require("crypto");

exports.generateAccessToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    process.env.JWT_ACCESS_SECRET,
    { expiresIn: "15m" },
  );
};

exports.generateRefreshToken = (user) => {
  // Add a random token identifier so multiple refresh operations in the same second
  // cannot produce identical refresh tokens (prevents UNIQUE constraint collisions).
  return jwt.sign({ id: user.id, jti: crypto.randomUUID() }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: "7d",
  });
};
