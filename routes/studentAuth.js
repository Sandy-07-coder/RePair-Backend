import express from 'express';
import {
  studentLogin,
  getStudentMe,
  getStudentTasks,
  completeTask,
  logMood,
  getMoodHistory,
} from '../controllers/studentAuthController.js';
import { protectStudent } from '../middleware/studentAuthMiddleware.js';

const router = express.Router();

// Public routes
router.post('/login', studentLogin);

// Protected routes (student JWT required)
router.get('/me',                               protectStudent, getStudentMe);
router.get('/tasks',                            protectStudent, getStudentTasks);
router.patch('/tasks/:taskId/complete',         protectStudent, completeTask);

// Mood tracking
router.post('/mood',                            protectStudent, logMood);
router.get('/mood-history',                     protectStudent, getMoodHistory);

export default router;


