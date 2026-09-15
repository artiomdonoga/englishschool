const jwt = require('jsonwebtoken');
const SECRET = process.env.JWT_SECRET || 'englishschool_secret_2024';

function sign(user) {
  return jwt.sign({ id: user.id, role: user.role, name: user.name }, SECRET, { expiresIn: '7d' });
}

function verify(token) {
  try { return jwt.verify(token, SECRET); }
  catch { return null; }
}

function requireAuth(roles = []) {
  return (req, res, next) => {
    const token = req.cookies?.token || req.headers.authorization?.split(' ')[1];
    const user = verify(token);
    if (!user) return res.status(401).json({ error: 'Unauthorized' });
    if (roles.length && !roles.includes(user.role)) return res.status(403).json({ error: 'Forbidden' });
    req.user = user;
    next();
  };
}

module.exports = { sign, verify, requireAuth };
