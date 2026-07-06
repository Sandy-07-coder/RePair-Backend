import jwt from 'jsonwebtoken';

export const protect = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'secret_repair_token_123';
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded.user;  // { id }
    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};
