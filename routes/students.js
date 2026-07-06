import express from 'express';
import { addStudent, getStudents } from '../controllers/studentController.js';
import { protect } from '../middleware/authMiddleware.js';

const router = express.Router();

// @route   POST /api/students
// @desc    Add a new student
// @access  Private
router.post('/', protect, addStudent);

// @route   GET /api/students
// @desc    Get all students with pagination
// @access  Private
router.get('/', protect, getStudents);

export default router;
