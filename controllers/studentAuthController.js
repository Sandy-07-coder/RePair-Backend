import Student from '../models/Student.js';
import Task from '../models/Task.js';
import MoodHistory from '../models/MoodHistory.js';
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

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/student-auth/tasks?mood=happy
// @desc    Return tasks assigned to the authenticated student.
//          Pass ?mood=happy|sad|angry|tired to filter to tasks tagged with
//          that mood; omit the query param to get ALL tasks.
// @access  Private (student JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentTasks = async (req, res) => {
  try {
    const studentId = req.student.id;

    const filter = { student: studentId };

    const tasks1 = await Task.find({ student: studentId });
    console.log("All tasks for student:", tasks1);

    // Filter by mood when the child selects one
    if (req.query.mood) {
      filter.mood = req.query.mood.toLowerCase();
    }

    const tasks = await Task.find(filter)
      .select('title description imageUrl status mood createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ tasks });
  } catch (error) {
    console.error('getStudentTasks error:', error);
    res.status(500).json({ message: 'Server error while fetching tasks.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/student-auth/tasks/:taskId/complete
// @desc    Mark a task as Completed by the authenticated student.
//          Also recalculates and persists the student's overall taskCompletion %.
// @access  Private (student JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const completeTask = async (req, res) => {
  try {
    const studentId = req.student.id;
    const { taskId }  = req.params;

    // Guard: valid 24-char hex id
    if (!taskId || !/^[a-f\d]{24}$/i.test(taskId)) {
      return res.status(400).json({ message: 'Invalid task ID.' });
    }

    // Only allow the student who owns the task to mark it complete
    const task = await Task.findOneAndUpdate(
      { _id: taskId, student: studentId },
      { status: 'Completed' },
      { new: true }
    );

    if (!task) {
      return res.status(404).json({ message: 'Task not found or access denied.' });
    }

    // ── Recalculate overall completion % for this student ─────────────────
    const allTasks   = await Task.find({ student: studentId }).select('status').lean();
    const total      = allTasks.length;
    const completed  = allTasks.filter((t) => t.status === 'Completed').length;
    const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

    await Student.findByIdAndUpdate(studentId, { taskCompletion: `${pct}%` });

    res.json({
      message: 'Task marked as completed.',
      task,
      taskCompletion: `${pct}%`,
    });
  } catch (error) {
    console.error('completeTask error:', error);
    res.status(500).json({ message: 'Server error while completing task.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   POST /api/student-auth/mood
// @desc    Log a mood selection for the authenticated student.
//          Body: { mood: 'happy' | 'sad' | 'angry' | 'tired' }
//          Also updates the quick-access `mood` field on the Student document.
// @access  Private (student JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const logMood = async (req, res) => {
  try {
    const studentId = req.student.id;
    const { mood } = req.body;

    const allowed = ['happy', 'sad', 'angry', 'tired'];
    if (!mood || !allowed.includes(mood.toLowerCase())) {
      return res.status(400).json({
        message: `Invalid mood. Must be one of: ${allowed.join(', ')}.`,
      });
    }

    const normalizedMood = mood.toLowerCase();

    // ISO date string for today (UTC) — used as the grouping key
    const todayISO = new Date().toISOString().slice(0, 10); // "2026-07-18"

    // Persist the mood entry
    const entry = await MoodHistory.create({
      student: studentId,
      mood: normalizedMood,
      date: todayISO,
    });

    // Keep the Student.mood field in sync for quick reads
    await Student.findByIdAndUpdate(studentId, { mood: normalizedMood });

    res.status(201).json({
      message: 'Mood logged successfully.',
      entry: {
        id: entry._id,
        mood: entry.mood,
        date: entry.date,
        createdAt: entry.createdAt,
      },
    });
  } catch (error) {
    console.error('logMood error:', error);
    res.status(500).json({ message: 'Server error while logging mood.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/student-auth/mood-history
// @desc    Return the last 7 days of mood history for the authenticated student.
//          Response shape:
//          {
//            history: [
//              { date: '2026-07-18', mood: 'happy', createdAt: '...' },
//              ...
//            ]
//          }
//          One entry per day (the most-recent mood of that day).
// @access  Private (student JWT required)
// ─────────────────────────────────────────────────────────────────────────────
export const getMoodHistory = async (req, res) => {
  try {
    const studentId = req.student.id;

    // Build the date range: last 7 days (today inclusive)
    const today = new Date();
    const dates = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today);
      d.setDate(today.getDate() - i);
      return d.toISOString().slice(0, 10); // "YYYY-MM-DD"
    }); // descending: [today, yesterday, …, 6 days ago]

    const earliest = dates[dates.length - 1];

    // Fetch all entries in that window, newest first
    const raw = await MoodHistory.find({
      student: studentId,
      date: { $gte: earliest },
    })
      .sort({ date: -1, createdAt: -1 })
      .select('mood date createdAt')
      .lean();

    // Group: keep only the latest entry per date
    const byDate = new Map();
    for (const entry of raw) {
      if (!byDate.has(entry.date)) {
        byDate.set(entry.date, entry);
      }
    }

    // Build the 7-slot array (null for days with no entry yet)
    const history = dates.map((date) => ({
      date,
      mood: byDate.get(date)?.mood ?? null,
      createdAt: byDate.get(date)?.createdAt ?? null,
    }));

    res.json({ history });
  } catch (error) {
    console.error('getMoodHistory error:', error);
    res.status(500).json({ message: 'Server error while fetching mood history.' });
  }
};
