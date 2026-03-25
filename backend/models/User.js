const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true, minlength: 6 },
  phone: { type: String, required: true },
  role: { type: String, enum: ['patient', 'pharmacy', 'admin'], default: 'patient' },
  isActive: { type: Boolean, default: true },
  isApproved: { type: Boolean, default: false },
  profileImage: { type: String },

  // Patient specific
  patientProfile: {
    dateOfBirth: Date,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    address: String,
    district: String,
    province: String,
    gramaNiladhari: { divisionName: String, divisionCode: String },
  },

  // Pharmacy specific
  pharmacyProfile: {
    licenseNumber: String,
    registrationNumber: String,
    address: String,
    district: String,
    province: String,
    gramaNiladhari: { divisionName: String, divisionCode: String },
    // GeoJSON point for proximity queries
    location: {
      type: { type: String, enum: ['Point'], default: 'Point' },
      coordinates: { type: [Number], default: [0, 0] },  // [lng, lat]
    },
    openHours: String,
    isDeliveryAvailable: { type: Boolean, default: false },
    deliveryRadiusKm: { type: Number, default: 5 },
    description: String,
  },

  refreshToken: String,
}, { timestamps: true });

// 2dsphere index for geo queries
userSchema.index({ 'pharmacyProfile.location': '2dsphere' });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toJSON = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshToken;
  return obj;
};

module.exports = mongoose.model('User', userSchema);
