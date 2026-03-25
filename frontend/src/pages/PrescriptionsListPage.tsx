import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Plus, FileText, Search } from 'lucide-react';
import { prescriptionAPI } from '../services/api';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format } from 'date-fns';

export default function PrescriptionsListPage() {
  const [prescriptions, setPrescriptions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await prescriptionAPI.getAll({ status: status || undefined, limit: 20 });
        setPrescriptions(data.prescriptions);
      } catch { } finally { setLoading(false); }
    };
    load();
  }, [status]);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-display font-bold">My Prescriptions</h1>
        <Link to="/patient/upload" className="btn-primary flex items-center gap-2 text-sm">
          <Plus className="w-4 h-4" /> Upload New
        </Link>
      </div>

      <div className="flex gap-2 flex-wrap mb-4">
        {['', 'processing', 'extracted', 'quote_requested', 'quotes_received', 'accepted', 'delivered'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${status === s ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'}`}>
            {s === '' ? 'All' : s.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}
          </button>
        ))}
      </div>

      {loading ? <LoadingSpinner size="lg" /> : prescriptions.length === 0 ? (
        <div className="text-center py-16">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">No prescriptions found</p>
          <Link to="/patient/upload" className="btn-primary mt-4 inline-flex items-center gap-2 text-sm">
            <Plus className="w-4 h-4" /> Upload First Prescription
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {prescriptions.map(p => (
            <Link to={`/patient/prescriptions/${p._id}`} key={p._id}
              className="card flex items-center gap-4 hover:border-primary-200 transition-colors">
              {p.imageUrl && <img src={p.imageUrl} alt="Rx" className="w-16 h-16 object-cover rounded-xl border flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 text-sm">
                  {p.extractedMedicines?.length > 0 ? `${p.extractedMedicines.length} medicine(s)` : 'Processing...'}
                </p>
                {p.extractedMedicines?.slice(0, 2).map((m: any, i: number) => (
                  <span key={i} className="text-xs text-gray-500 mr-2">{m.name}</span>
                ))}
                {p.extractedMedicines?.length > 2 && (
                  <span className="text-xs text-gray-400">+{p.extractedMedicines.length - 2} more</span>
                )}
                <p className="text-xs text-gray-400 mt-1">{format(new Date(p.createdAt), 'MMM d, yyyy')}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge status={p.status} />
                {p.isUrgent && <span className="text-xs text-red-600">🚨 Urgent</span>}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
