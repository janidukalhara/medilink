const User = require('../models/User');
const { generateAccessToken } = require('../utils/jwt');
const { sendEmail, prescriptionProcessedTemplate } = require('../utils/email');

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role, patientProfile, pharmacyProfile } = req.body;

    const exists = await User.findOne({ email });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const userData = { name, email, password, phone, role: role || 'patient' };

    if (role === 'patient' && patientProfile) {
      userData.patientProfile = patientProfile;
    }
    if (role === 'pharmacy' && pharmacyProfile) {
      userData.pharmacyProfile = pharmacyProfile;
      userData.isApproved = false; // needs admin approval
    }
    if (role === 'patient') userData.isApproved = true;

    const user = await User.create(userData);
    const token = generateAccessToken(user);

    res.status(201).json({
      message: role === 'pharmacy'
        ? 'Registration successful. Awaiting admin approval.'
        : 'Registration successful.',
      token,
      user,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });
    if (!user.isActive) return res.status(403).json({ error: 'Account deactivated' });

    const match = await user.comparePassword(password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    const token = generateAccessToken(user);
    res.json({ token, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.getMe = async (req, res) => {
  res.json({ user: req.user });
};

exports.updateProfile = async (req, res) => {
  try {
    const updates = req.body;
    delete updates.password;
    delete updates.role;
    delete updates.email;

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id);
    const match = await user.comparePassword(currentPassword);
    if (!match) return res.status(400).json({ error: 'Current password incorrect' });
    user.password = newPassword;
    await user.save();
    res.json({ message: 'Password changed successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
