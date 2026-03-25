import React, { useState, useEffect } from 'react';
import { Users, Activity, CheckCircle, XCircle, AlertCircle, BarChart2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function AdminDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [pendingPharmacies, setPendingPharmacies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);

  const load = async () => {
    try {
      const [dashRes, pendingRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getPendingPharmacies(),
      ]);
      setStats(dashRes.data.stats);
      setPendingPharmacies(pendingRes.data.pharmacies);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  const approve = async (id: string) => {
    setActionId(id);
    try {
      await adminAPI.approvePharmacy(id);
      toast.success('Pharmacy approved!');
      load();
    } catch { toast.error('Failed'); } finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    setActionId(id);
    try {
      await adminAPI.rejectPharmacy(id);
      toast.success('Pharmacy rejected');
      load();
    } catch { toast.error('Failed'); } finally { setActionId(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold">Admin Dashboard</h1>
        <p className="text-gray-500 text-sm">MediLink Platform Overview</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Patients', value: stats?.totalPatients, icon: Users, color: 'bg-blue-50 text-blue-600' },
          { label: 'Pharmacies', value: stats?.totalPharmacies, icon: Activity, color: 'bg-teal-50 text-teal-600' },
          { label: 'Prescriptions', value: stats?.totalPrescriptions, icon: BarChart2, color: 'bg-purple-50 text-purple-600' },
          { label: 'Avg OCR Accuracy', value: `${stats?.avgOCRConfidence}%`, icon: CheckCircle, color: 'bg-green-50 text-green-600' },
        ].map(s => (
          <div key={s.label} className="card flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="w-5 h-5" /></div>
            <div>
              <p className="text-xl font-bold">{s.value}</p>
              <p className="text-xs text-gray-500">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Today's stats */}
        <div className="card">
          <h2 className="font-semibold mb-3">Today's Activity</h2>
          <div className="space-y-3">
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">Prescriptions Processed</span>
              <span className="font-bold text-primary-600">{stats?.processedToday}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">Pending Pharmacy Approvals</span>
              <span className={`font-bold ${stats?.pendingPharmacies > 0 ? 'text-yellow-600' : 'text-gray-600'}`}>{stats?.pendingPharmacies}</span>
            </div>
            <div className="flex justify-between items-center py-2 border-b">
              <span className="text-sm text-gray-600">Failed OCR Count</span>
              <span className={`font-bold ${stats?.failedOCR > 0 ? 'text-red-600' : 'text-gray-600'}`}>{stats?.failedOCR}</span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-sm text-gray-600">Accepted Quotations</span>
              <span className="font-bold text-green-600">{stats?.acceptedQuotations}</span>
            </div>
          </div>
        </div>

        {/* Pending Pharmacy Approvals */}
        <div className="card">
          <h2 className="font-semibold mb-3 flex items-center gap-2">
            Pending Approvals
            {pendingPharmacies.length > 0 && (
              <span className="badge bg-yellow-100 text-yellow-700">{pendingPharmacies.length}</span>
            )}
          </h2>
          {pendingPharmacies.length === 0 ? (
            <div className="text-center py-6">
              <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-sm text-gray-500">All pharmacies approved!</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-80 overflow-y-auto">
              {pendingPharmacies.map(p => (
                <div key={p._id} className="p-3 bg-gray-50 rounded-xl">
                  <div className="mb-2">
                    <p className="font-medium text-sm">{p.name}</p>
                    <p className="text-xs text-gray-500">{p.email} • {p.phone}</p>
                    {p.pharmacyProfile?.licenseNumber && (
                      <p className="text-xs text-gray-500">License: {p.pharmacyProfile.licenseNumber}</p>
                    )}
                    {p.pharmacyProfile?.district && (
                      <p className="text-xs text-gray-500">
                        {p.pharmacyProfile.district}, {p.pharmacyProfile.province}
                        {p.pharmacyProfile?.gramaNiladhari?.divisionName && ` • GN: ${p.pharmacyProfile.gramaNiladhari.divisionName}`}
                      </p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(p._id)} disabled={actionId === p._id}
                      className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1">
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button onClick={() => reject(p._id)} disabled={actionId === p._id}
                      className="flex-1 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center justify-center gap-1">
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
