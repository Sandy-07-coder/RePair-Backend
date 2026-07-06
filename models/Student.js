import mongoose from 'mongoose';

const StudentSchema = new mongoose.Schema(
  {
    // ── Personal Info ──────────────────────────────────────────────────
    name: { type: String, required: true, trim: true },
    age: { type: Number, required: true, min: 1, max: 100 },
    gender: {
      type: String,
      required: true,
      enum: ['Male', 'Female', 'Other', 'Prefer not to say'],
    },

    // ── Clinical Info ──────────────────────────────────────────────────
    diagnosis: { type: String, required: true, trim: true },
    notes: { type: String, trim: true, default: '' },

    // ── Assessment ─────────────────────────────────────────────────────
    // 'pending'   – specialist chose "Skip Assessment" (to be done later)
    // 'completed' – assessment was taken and results stored
    assessmentStatus: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },

    // ── Progress / Tracking (mirrors the old hard-coded shape) ─────────
    mood: { type: String, default: '' },
    taskCompletion: { type: String, default: '0%' }, // stored as "72%"

    // ── Ownership ──────────────────────────────────────────────────────
    // The specialist (User) who created this student record
    specialist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model('Student', StudentSchema);
