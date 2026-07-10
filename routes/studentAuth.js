import express from 'express';
import { studentLogin, getStudentMe } from '../controllers/studentAuthController.js';
import { protectStudent } from '../middleware/studentAuthMiddleware.js';

const router = express.Router();

// @route   POST /api/student-auth/login
// @desc    Login a student and receive a 30-day JWT
// @access  Public
router.post('/login', studentLogin);

// @route   GET /api/student-auth/me
// @desc    Get the authenticated student's profile
// @access  Private (student JWT)
router.get('/me', protectStudent, getStudentMe);

export default router;
