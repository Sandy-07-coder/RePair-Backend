import jwt from 'jsonwebtoken';

/**
 * Middleware to protect student-only routes.
 * Expects a Bearer token signed with the student secret.
 * Populates req.student = { id, role: 'student' }
 */
export const protectStudent = (req, res, next) => {
  const JWT_SECRET = process.env.JWT_SECRET || 'secret_repair_token_123';
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);

    // Ensure this is a student token (not a specialist token)
    if (!decoded.student) {
      return res.status(403).json({ message: 'Access denied: student token required' });
    }

    req.student = decoded.student; // { id }
    next();
  } catch (err) {
    console.error('Student JWT Verification Error:', err.message);
    return res.status(401).json({ message: 'Token is not valid' });
  }
};
