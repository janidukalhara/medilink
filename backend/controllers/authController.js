const User = require('../models/User');
const { generateAccessToken } = require('../utils/jwt');
const { sendEmail, prescriptionProcessedTemplate } = require('../utils/email');

// Allowed fields per role for profile updates (whitelist)
const PATIENT_PROFILE_FIELDS = ['dateOfBirth', 'gender', 'address', 'district', 'province', 'gramaNiladhari'];
const PHARMACY_PROFILE_FIELDS = [
  'address', 'district', 'province', 'gramaNiladhari',
  'openHours', 'isDeliveryAvailable', 'deliveryRadiusKm', 'description', 'location',
];

exports.register = async (req, res) => {
  try {
    const { name, email, password, phone, role, patientProfile, pharmacyProfile } = req.body;

    // SECURITY FIX: Block self-registration as admin
    if (!role || role === 'admin') {
      return res.status(403).json({ error: 'Invalid role for self-registration' });
    }

    // SECURITY FIX: Validate role is only patient or pharmacy
    if (!['patient', 'pharmacy'].includes(role)) {
      return res.status(400).json({ error: 'Role must be patient or pharmacy' });
    }

    // FIX: Input validation
    if (!name?.trim()) return res.status(400).json({ error: 'Name is required' });
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required' });
    if (!password || password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    if (!phone?.trim()) return res.status(400).json({ error: 'Phone is required' });

    const exists = await User.findOne({ email: email.toLowerCase() });
    if (exists) return res.status(400).json({ error: 'Email already registered' });

    const userData = { name: name.trim(), email, password, phone: phone.trim(), role };

    if (role === 'patient' && patientProfile) {
      // SECURITY FIX: Only allow whitelisted patient profile fields
      const safeProfile = {};
      PATIENT_PROFILE_FIELDS.forEach(f => {
        if (patientProfile[f] !== undefined) safeProfile[f] = patientProfile[f];
      });
      userData.patientProfile = safeProfile;
    }

    if (role === 'pharmacy' && pharmacyProfile) {
      // SECURITY FIX: Only allow whitelisted pharmacy profile fields
      const safeProfile = {};
      PHARMACY_PROFILE_FIELDS.forEach(f => {
        if (pharmacyProfile[f] !== undefined) safeProfile[f] = pharmacyProfile[f];
      });
      userData.pharmacyProfile = safeProfile;
      userData.isApproved = false; // must be set server-side only
    }

    // SECURITY FIX: isApproved is always server-controlled
    userData.isApproved = role === 'patient' ? true : false;
    userData.isActive = true;

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

    // FIX: Input validation
    if (!email?.trim() || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
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
    const updates = { ...req.body };

    // SECURITY FIX: Strip ALL sensitive and privilege fields from update
    const FORBIDDEN_FIELDS = ['password', 'role', 'email', 'isApproved', 'isActive', 'refreshToken', '_id'];
    FORBIDDEN_FIELDS.forEach(f => delete updates[f]);

    // SECURITY FIX: Whitelist nested profile fields
    if (updates.patientProfile) {
      const safeProfile = {};
      PATIENT_PROFILE_FIELDS.forEach(f => {
        if (updates.patientProfile[f] !== undefined) safeProfile[f] = updates.patientProfile[f];
      });
      updates.patientProfile = safeProfile;
    }

    if (updates.pharmacyProfile) {
      const safeProfile = {};
      PHARMACY_PROFILE_FIELDS.forEach(f => {
        if (updates.pharmacyProfile[f] !== undefined) safeProfile[f] = updates.pharmacyProfile[f];
      });
      updates.pharmacyProfile = safeProfile;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true });
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // FIX: Input validation
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Both current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

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
