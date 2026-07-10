import Student from '../models/Student.js';
import bcrypt from 'bcryptjs';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Build and resolve a unique username.
 * Pattern: <studentFirst>_<parentFirst>[optional 2-digit suffix]
 */
async function resolveUniqueUsername(studentName, parentName, excludeId = null) {
  const studentFirst = studentName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const parentFirst  = (parentName || '').trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '') || 'parent';
  const base         = `${studentFirst}_${parentFirst}`;

  let username = base;
  let attempt  = 0;

  while (true) {
    const filter = { username };
    if (excludeId) filter._id = { $ne: excludeId };

    const conflict = await Student.findOne(filter);
    if (!conflict) break;

    const suffix = String(Math.floor(10 + Math.random() * 90)); // 10–99
    username = `${base}${suffix}`;

    if (++attempt > 20) {
      username = `${base}${Date.now().toString().slice(-4)}`;
      break;
    }
  }

  return { username, base };
}

/**
 * Compute the default plain-text password:
 * first 4 chars of student's first name + 4-digit birth year.
 * e.g. name="Liam Johnson", dob=2019-03-01  →  "liam2019"
 */
function defaultPassword(studentName, dob) {
  const first     = studentName.trim().split(/\s+/)[0].toLowerCase().replace(/[^a-z0-9]/g, '');
  const namePart  = first.slice(0, 4).padEnd(4, '0');
  const birthYear = new Date(dob).getFullYear();
  return `${namePart}${birthYear}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// @route   GET /api/students/:id/credentials
// @desc    Get current username and whether password has been customised
// @access  Private (specialist JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const getStudentCredentials = async (req, res) => {
  try {
    const student = await Student.findOne({
      _id: req.params.id,
      specialist: req.user.id,
    }).lean();

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // Compute what the current default password WOULD be (always derivable)
    const plain = defaultPassword(student.name, student.dob);

    res.json({
      username:        student.username || null,
      email:           student.email    || '',
      parentName:      student.parentName || '',
      defaultPassword: plain, // show so specialist can share with parent
      hasCredentials:  !!(student.username && student.password),
    });
  } catch (error) {
    console.error('getStudentCredentials error:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// @route   PATCH /api/students/:id/credentials
// @desc    Specialist updates student's email, username, and/or password.
//          - email:    optional; stored for parent comms
//          - username: optional override; if omitted, auto-generated from names
//          - password: optional override; if omitted, resets to default formula
// @body    { email?, username?, password?, regenerateUsername? }
// @access  Private (specialist JWT)
// ─────────────────────────────────────────────────────────────────────────────
export const setStudentCredentials = async (req, res) => {
  try {
    const { email, username: customUsername, password: customPassword, regenerateUsername } = req.body;

    const student = await Student.findOne({
      _id: req.params.id,
      specialist: req.user.id,
    });

    if (!student) {
      return res.status(404).json({ message: 'Student not found.' });
    }

    // ── Email ──────────────────────────────────────────────────────────────
    if (email !== undefined) {
      student.email = email ? email.trim().toLowerCase() : '';
    }

    // ── Username ───────────────────────────────────────────────────────────
    let resolvedUsername = student.username;
    let usernameChanged  = false;

    if (customUsername) {
      // Specialist is manually overriding the username
      const proposed = customUsername.trim().toLowerCase().replace(/[^a-z0-9_]/g, '');
      if (!proposed) {
        return res.status(400).json({ message: 'Invalid username format.' });
      }

      // Check uniqueness (exclude this student)
      const conflict = await Student.findOne({ username: proposed, _id: { $ne: student._id } });
      if (conflict) {
        // Auto-suffix to keep uniqueness instead of rejecting
        const suffix = String(Math.floor(10 + Math.random() * 90));
        resolvedUsername = `${proposed}${suffix}`;
      } else {
        resolvedUsername = proposed;
      }
      usernameChanged = true;

    } else if (regenerateUsername || !student.username) {
      // Re-generate from student + parent name
      const { username: generated } = await resolveUniqueUsername(
        student.name,
        student.parentName,
        student._id
      );
      resolvedUsername = generated;
      usernameChanged  = true;
    }

    if (usernameChanged) {
      student.username = resolvedUsername;
    }

    // ── Password ───────────────────────────────────────────────────────────
    let rawPasswordUsed = null;

    if (customPassword) {
      if (customPassword.length < 4) {
        return res.status(400).json({ message: 'Password must be at least 4 characters.' });
      }
      const salt = await bcrypt.genSalt(10);
      student.password = await bcrypt.hash(customPassword, salt);
      rawPasswordUsed  = customPassword;
    } else if (!student.password) {
      // First-time setup with no custom password — use the default formula
      const raw  = defaultPassword(student.name, student.dob);
      const salt = await bcrypt.genSalt(10);
      student.password = await bcrypt.hash(raw, salt);
      rawPasswordUsed  = raw;
    }
    // If student.password already exists and no new password supplied, keep existing

    await student.save();

    const plain = defaultPassword(student.name, student.dob);

    res.json({
      message: 'Credentials updated successfully.',
      username:        student.username,
      email:           student.email,
      // Only surface default password if it's a fresh setup or explicit reset
      defaultPassword: rawPasswordUsed ?? plain,
      student: {
        id:         student._id,
        name:       student.name,
        parentName: student.parentName,
        username:   student.username,
        email:      student.email,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: 'Username conflict. Try regenerating.' });
    }
    console.error('setStudentCredentials error:', error);
    res.status(500).json({ message: 'Server error while updating credentials.' });
  }
};
