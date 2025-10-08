const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const db = require('./db');
const JWT_SECRET = process.env.JWT_SECRET || 'dev_secret';

function generateToken(user) {
  const payload = { ...user };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

function verifyTokenMiddleware(req, res, next) {
  const auth = req.headers.authorization;
  if (!auth) return res.status(401).json({ error: 'Missing token' });
  const token = auth.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}

module.exports = { generateToken, verifyTokenMiddleware };
