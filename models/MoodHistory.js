import mongoose from 'mongoose';

/**
 * MoodHistory — one entry per mood check-in.
 * A student can log multiple moods per day; the API exposes helpers
 * that group by day and pick the most-recent one for display.
 */
const MoodHistorySchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Student',
      required: true,
      index: true,
    },
    mood: {
      type: String,
      required: true,
      enum: ['happy', 'sad', 'angry', 'tired'],
      lowercase: true,
    },
    // ISO date string of the day (YYYY-MM-DD) — handy for grouping
    date: {
      type: String, // e.g. "2026-07-18"
      required: true,
    },
  },
  { timestamps: true }
);

// Compound index so we can quickly query the last 7 days for a student
MoodHistorySchema.index({ student: 1, date: -1 });

export default mongoose.model('MoodHistory', MoodHistorySchema);
