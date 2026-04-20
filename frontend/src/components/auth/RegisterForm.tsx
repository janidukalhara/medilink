import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Eye, EyeOff, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { authAPI } from '../../services/api';
import LocationPicker from '../common/LocationPicker';

type Role = 'patient' | 'pharmacy';

export default function RegisterForm() {
  const navigate = useNavigate();
  const [role, setRole] = useState<Role>('patient');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    name: '', email: '', password: '', phone: '',
    // patient
    dateOfBirth: '', gender: '',
    // pharmacy
    licenseNumber: '', registrationNumber: '',
    openHours: '', isDeliveryAvailable: false, description: '',
  });

  // Location state — set by LocationPicker
  const [locationData, setLocationData] = useState({
    address: '',
    lat: 0,
    lng: 0,
    district: '',
    province: '',
  });

  // GN division — still manual since Nominatim doesn't return GN codes
  const [gnDivisionName, setGnDivisionName] = useState('');
  const [gnDivisionCode, setGnDivisionCode] = useState('');

  const set = (field: string, value: any) => setForm(p => ({ ...p, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!locationData.address) {
      toast.error('Please select your address using the location picker');
      return;
    }
    setLoading(true);
    try {
      const payload: any = {
        name: form.name, email: form.email, password: form.password,
        phone: form.phone, role,
      };

      const location = {
        address: locationData.address,
        district: locationData.district,
        province: locationData.province,
        gramaNiladhari: { divisionName: gnDivisionName, divisionCode: gnDivisionCode },
      };

      if (role === 'patient') {
        payload.patientProfile = {
          dateOfBirth: form.dateOfBirth,
          gender: form.gender,
          ...location,
        };
      } else {
        payload.pharmacyProfile = {
          licenseNumber: form.licenseNumber,
          registrationNumber: form.registrationNumber,
          openHours: form.openHours,
          isDeliveryAvailable: form.isDeliveryAvailable,
          description: form.description,
          ...location,
          // Store GPS coords for geo queries
          location: {
            type: 'Point',
            coordinates: [locationData.lng, locationData.lat],
          },
        };
      }

      await authAPI.register(payload);
      toast.success(role === 'pharmacy'
        ? 'Registration successful! Awaiting admin approval.'
        : 'Registration successful!');
      navigate('/login');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="w-10 h-10 bg-primary-600 rounded-xl flex items-center justify-center">
            <Activity className="w-6 h-6 text-white" />
          </div>
          <span className="font-display font-bold text-2xl text-primary-700">MediLink</span>
        </div>

        <h2 className="text-2xl font-display font-bold text-center text-gray-900 mb-2">Create Account</h2>
        <p className="text-center text-gray-500 text-sm mb-6">Join MediLink to manage prescriptions smartly</p>

        {/* Role Toggle */}
        <div className="flex rounded-xl bg-gray-100 p-1 mb-6">
          {(['patient', 'pharmacy'] as Role[]).map(r => (
            <button key={r} type="button" onClick={() => setRole(r)}
              className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all capitalize ${role === r ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-600'}`}>
              {r === 'patient' ? '🧑 Patient' : '🏥 Pharmacy'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Basic info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Full Name *</label>
              <input className="input" required value={form.name} onChange={e => set('name', e.target.value)} placeholder="John Perera" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
              <input className="input" type="email" required value={form.email} onChange={e => set('email', e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
              <input className="input" required value={form.phone} onChange={e => set('phone', e.target.value)} placeholder="+94771234567" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Password *</label>
              <div className="relative">
                <input className="input pr-10" type={showPass ? 'text' : 'password'} required minLength={6}
                  value={form.password} onChange={e => set('password', e.target.value)} placeholder="Min 6 characters" />
                <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5">
                  {showPass ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
                </button>
              </div>
            </div>
          </div>

          {/* Role-specific fields */}
          {role === 'patient' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Date of Birth</label>
                <input className="input" type="date" value={form.dateOfBirth} onChange={e => set('dateOfBirth', e.target.value)} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Gender</label>
                <select className="input" value={form.gender} onChange={e => set('gender', e.target.value)}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>
          )}

          {role === 'pharmacy' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">License Number *</label>
                <input className="input" required value={form.licenseNumber} onChange={e => set('licenseNumber', e.target.value)} placeholder="PH/LIC/2024/001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Registration No.</label>
                <input className="input" value={form.registrationNumber} onChange={e => set('registrationNumber', e.target.value)} placeholder="REG001" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Open Hours</label>
                <input className="input" value={form.openHours} onChange={e => set('openHours', e.target.value)} placeholder="8:00 AM - 10:00 PM" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <input type="checkbox" id="delivery" checked={form.isDeliveryAvailable}
                  onChange={e => set('isDeliveryAvailable', e.target.checked)} className="w-4 h-4 rounded" />
                <label htmlFor="delivery" className="text-sm text-gray-700">Delivery Available</label>
              </div>
              <div className="col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
                <textarea className="input resize-none" rows={2} value={form.description}
                  onChange={e => set('description', e.target.value)} placeholder="Brief description of your pharmacy..." />
              </div>
            </div>
          )}

          {/* Location — smart picker */}
          <div className="border-t pt-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-1.5">
              📍 Location
              <span className="text-xs font-normal text-gray-400">(search, use GPS, or drag pin on map)</span>
            </h3>
            <LocationPicker
              placeholder="Search your address in Sri Lanka..."
              initialAddress={locationData.address}
              onLocationSelect={(result) => {
                setLocationData({
                  address: result.address,
                  lat: result.lat,
                  lng: result.lng,
                  district: result.district || '',
                  province: result.province || '',
                });
              }}
            />

            {/* Show auto-filled district/province */}
            {locationData.district && (
              <div className="mt-3 grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">District (auto-detected)</label>
                  <input className="input bg-gray-50 text-gray-600" readOnly value={locationData.district} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-500 mb-1">Province (auto-detected)</label>
                  <input className="input bg-gray-50 text-gray-600" readOnly value={locationData.province} />
                </div>
              </div>
            )}

            {/* Manual GN Division entry */}
            <div className="mt-3">
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Grama Niladhari Division
                <span className="text-gray-400 font-normal ml-1">(required)</span>
              </label>
              <input className="input" value={gnDivisionName}
                onChange={e => setGnDivisionName(e.target.value)}
                placeholder="e.g. Colombo Fort, Kandy City..." />
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-semibold mt-2">
            {loading ? 'Creating account...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-gray-600 mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
