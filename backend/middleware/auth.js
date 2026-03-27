const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'ustoz_yordamchi_secret_2024';

const authMiddleware = (roles = []) => {
  return (req, res, next) => {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'Token kerak' });
    try {
      const decoded = jwt.verify(token, JWT_SECRET);
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json({ error: 'Ruxsat yoq' });
      }
      req.user = decoded;
      next();
    } catch {
      res.status(401).json({ error: 'Token noto\'g\'ri' });
    }
  };
};

module.exports = authMiddleware;
