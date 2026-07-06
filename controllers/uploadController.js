import User from '../models/User.js';

/**
 * @route   POST /api/auth/upload-photo
 * @desc    Upload or update the specialist's profile photo to Cloudinary
 * @access  Private
 */
export const uploadProfilePhoto = async (req, res) => {
  try {
    // req.file is populated by multer-storage-cloudinary after upload
    if (!req.file) {
      return res.status(400).json({ message: 'No image file provided.' });
    }

    const profileUrl = req.file.path; // Cloudinary secure URL

    const user = await User.findByIdAndUpdate(
      req.user.id,
      { profileUrl },
      { new: true }
    ).select('-password');

    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    res.json({ message: 'Profile photo updated successfully.', profileUrl });
  } catch (error) {
    console.error(error.message);
    res.status(500).send('Server error');
  }
};
