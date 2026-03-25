import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Upload, FileText, Clock, CheckCircle, AlertCircle, TrendingUp, Plus } from 'lucide-react';
import { prescriptionAPI, analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function PatientDashboard() {
  const { user } = useAuth();
  const socket = useSocket();
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    try {
      const [presRes, analyticsRes] = await Promise.all([
        prescriptionAPI.getAll({ limit: 5 }),
        analyticsAPI.patient(),
      ]);
      setPrescriptions(presRes.data.prescriptions);
      setAnalytics(analyticsRes.data);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('prescription_processed', () => { load(); toast.success('Prescription processed!'); });
    return () => { socket.off('prescription_processed'); };
  }, [socket]);

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  const statusMap: Record<string, any> = {};
  analytics?.byStatus?.forEach((s: any) => { statusMap[s._id] = s.count; });

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-gray-900">Good day, {user?.name?.split(' ')[0]}! 👋</h1>
          <p className="text-gray-500 text-sm mt-0.5">Manage your prescriptions and track orders</p>
        </div>
        <Link to="/patient/upload" className="btn-primary flex items-center gap-2">
          <Plus className="w-4 h-4" /> Upload Prescription
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total', value: analytics?.total || 0, icon: FileText, color: 'bg-blue-50 text-blue-600' },
          { label: 'Processing', value: statusMap['processing'] || 0, icon: Clock, color: 'bg-yellow-50 text-yellow-600' },
          { label: 'Quotes Ready', value: statusMap['quotes_received'] || 0, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
          { label: 'Delivered', value: statusMap['delivered'] || 0, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
        ].map(stat => (
          <div key={stat.label} className="card flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Prescriptions */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recent Prescriptions</h2>
          <Link to="/patient/prescriptions" className="text-sm text-primary-600 hover:underline">View all</Link>
        </div>

        {prescriptions.length === 0 ? (
          <div className="text-center py-10">
            <Upload className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">No prescriptions yet</p>
            <Link to="/patient/upload" className="btn-primary mt-4 inline-flex items-center gap-2">
              <Plus className="w-4 h-4" /> Upload your first prescription
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {prescriptions.map(p => (
              <Link to={`/patient/prescriptions/${p._id}`} key={p._id}
                className="flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                <div className="flex items-center gap-3">
                  {p.imageUrl && (
                    <img src={p.imageUrl} alt="Prescription" className="w-12 h-12 object-cover rounded-lg border" />
                  )}
                  <div>
                    <p className="font-medium text-gray-900 text-sm">
                      {p.extractedMedicines?.length > 0
                        ? `${p.extractedMedicines.length} medicine(s) extracted`
                        : 'Processing...'}
                    </p>
                    <p className="text-xs text-gray-500">{format(new Date(p.createdAt), 'MMM d, yyyy • h:mm a')}</p>
                    {p.isUrgent && <span className="text-xs text-red-600 font-medium">🚨 Urgent</span>}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <StatusBadge status={p.status} />
                  {p.ocrConfidence > 0 && (
                    <span className="text-xs text-gray-400">{p.ocrConfidence.toFixed(0)}% accuracy</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
