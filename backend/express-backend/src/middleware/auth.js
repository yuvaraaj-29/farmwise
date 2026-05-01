const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'farmwise-jwt-secret-2024';
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.replace('Bearer ', '');

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }
  try {
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}
module.exports = { authenticateToken, JWT_SECRET };
