import Student from '../models/Student.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = () => process.env.JWT_SECRET || 'secret_repair_token_123';

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/student-auth/login
// @desc    Authenticate a student with username + password
// @access  Public
// ─────────────────────────────────────────────────────────────────────────────
export const studentLogin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: 'Username and password are required.' });
    }

    // Find student by username (stored lowercase)
    const student = await Student.findOne({ username: username.trim().toLowerCase() });

    if (!student) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Ensure login credentials have been set up by a specialist
    if (!student.password) {
      return res.status(403).json({
        message: 'Login not yet set up for this account. Please contact your specialist.',
      });
    }

    // Compare submitted password against stored hash
    const isMatch = await bcrypt.compare(password, student.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Invalid credentials.' });
    }

    // Issue a 30-day JWT for the student
    // We use the key "student" (not "user") so the specialist middleware rejects it
    const payload = { student: { id: student._id } };
    const token = jwt.sign(payload, JWT_SECRET(), { expiresIn: '30d' });

    res.json({
      token,
      student: {
        id: student._id,
        name: student.name,
        username: student.username,
        mood: student.mood,
        taskCompletion: student.taskCompletion,
        assessmentStatus: student.assessmentStatus,
      },
    });
  } catch (error) {
    console.error('studentLogin error:', error);
    res.status(500).json({ message: 'Server error during student login.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/student-auth/me
// @desc    Get the authenticated student's profile
// @access  Private (student JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentMe = async (req, res) => {
  try {
    // req.student.id is injected by protectStudent middleware
    const student = await Student.findById(req.student.id).select('-password').lean();

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    res.json({ student });
  } catch (error) {
    console.error('getStudentMe error:', error);
    res.status(500).json({ message: 'Server error while fetching student profile.' });
  }
};
