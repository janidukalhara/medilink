const jwt = require('jsonwebtoken');

exports.generateAccessToken = (user) => {
  return jwt.sign(
    { id: user._id, role: user.role, name: user.name, email: user.email },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

exports.generateRefreshToken = (user) => {
  return jwt.sign({ id: user._id }, process.env.JWT_SECRET + '_refresh', { expiresIn: '30d' });
};
