import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Eye, EyeOff, Activity } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function LoginForm() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(form.email, form.password);
      // Navigate based on role (redirect handled in router)
      navigate('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Login failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-teal-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 bg-primary-600 rounded-xl flex items-center justify-center">
            <Activity className="w-7 h-7 text-white" />
          </div>
          <span className="font-display font-bold text-3xl text-primary-700">MediLink</span>
        </div>

        <h2 className="text-2xl font-display font-bold text-center mb-1">Welcome back</h2>
        <p className="text-center text-gray-500 text-sm mb-8">Sign in to your MediLink account</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              className="input" type="email" required
              value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
              placeholder="your@email.com"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <div className="relative">
              <input
                className="input pr-10" type={showPass ? 'text' : 'password'} required
                value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                placeholder="Your password"
              />
              <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-3 top-2.5">
                {showPass ? <EyeOff className="w-4 h-4 text-gray-400" /> : <Eye className="w-4 h-4 text-gray-400" />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="btn-primary w-full py-3 text-base font-semibold">
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-4 p-4 bg-blue-50 rounded-lg text-xs text-blue-700">
          <p className="font-semibold mb-1">Demo Credentials:</p>
          <p>Admin: admin@medilink.lk / Admin@123</p>
        </div>

        <p className="text-center text-sm text-gray-600 mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-primary-600 font-medium hover:underline">Create one</Link>
        </p>
      </div>
    </div>
  );
}
