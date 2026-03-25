import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Eye, Package, Truck, ShoppingCart, CheckCircle } from 'lucide-react';
import { quotationAPI } from '../services/api';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

const STATUS_TABS = [
  { key: 'pending',      label: 'Pending' },
  { key: 'submitted',    label: 'Submitted' },
  { key: 'accepted',     label: 'Accepted' },
  { key: 'confirmed',    label: 'Confirmed' },
  { key: 'preparing',    label: 'Preparing' },
  { key: 'dispatched',   label: 'Dispatched' },
  { key: 'pickup_ready', label: 'Ready' },
  { key: 'completed',    label: 'Completed' },
  { key: 'all',          label: 'All' },
];

// Quick status update buttons shown inline on active orders
const NEXT_STATUS_MAP: Record<string, { label: string; nextStatus: string; color: string }[]> = {
  accepted:     [{ label: '📦 Confirm Order',      nextStatus: 'confirmed',    color: 'bg-teal-600' }],
  confirmed:    [{ label: '🧴 Start Preparing',    nextStatus: 'preparing',    color: 'bg-orange-500' }],
  preparing: [
    { label: '🚚 Mark Dispatched',   nextStatus: 'dispatched',   color: 'bg-blue-600' },
    { label: '🏪 Ready for Pickup',  nextStatus: 'pickup_ready', color: 'bg-cyan-600' },
  ],
  dispatched:   [{ label: '✅ Mark Delivered',     nextStatus: 'delivered',    color: 'bg-green-600' }],
  pickup_ready: [{ label: '✅ Mark Picked Up',     nextStatus: 'picked_up',    color: 'bg-green-600' }],
};

export default function PharmacyRequestsPage() {
  const [requests, setRequests]   = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [status, setStatus]       = useState('pending');
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await quotationAPI.getPharmacyRequests({ status, limit: 20 });
      setRequests(data.quotations);
    } catch { } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, [status]);

  const updateStatus = async (quotationId: string, nextStatus: string) => {
    setUpdatingId(quotationId);
    try {
      await quotationAPI.updateStatus(quotationId, nextStatus);
      toast.success(`✅ Status updated to: ${nextStatus.replace(/_/g, ' ')}`);
      await load();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Update failed'); }
    finally { setUpdatingId(null); }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-xl font-display font-bold mb-4">Prescription Requests</h1>

      {/* Status tabs */}
      <div className="flex gap-1.5 flex-wrap mb-4">
        {STATUS_TABS.map(t => (
          <button key={t.key} onClick={() => setStatus(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full border font-medium transition-colors
              ${status === t.key ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>
      ) : requests.length === 0 ? (
        <div className="text-center py-16">
          <ClipboardList className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-400 text-sm">No {status !== 'all' ? status : ''} requests</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map(q => {
            const nextButtons = NEXT_STATUS_MAP[q.orderStatus] || [];
            return (
              <div key={q._id} className="card">
                <div className="flex items-start gap-4 flex-wrap">
                  {q.prescription?.imageUrl && (
                    <img src={q.prescription.imageUrl} alt="Rx"
                      className="w-16 h-16 object-cover rounded-xl border flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between flex-wrap gap-2">
                      <div>
                        <p className="font-semibold text-sm text-gray-900">{q.patient?.name}</p>
                        <p className="text-xs text-gray-400">
                          {q.patient?.patientProfile?.district}
                          {q.patient?.patientProfile?.gramaNiladhari?.divisionName &&
                            ` · GN: ${q.patient.patientProfile.gramaNiladhari.divisionName}`}
                        </p>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {q.prescription?.extractedMedicines?.length || 0} medicine(s) ·{' '}
                          {format(new Date(q.createdAt), 'MMM d, h:mm a')}
                          {q.prescription?.isUrgent && <span className="text-red-500 ml-2 font-medium">🚨 Urgent</span>}
                        </p>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <StatusBadge status={q.orderStatus} />
                        {q.totalAmount > 0 && (
                          <span className="text-sm font-bold text-primary-600">LKR {q.totalAmount.toFixed(0)}</span>
                        )}
                        {q.fulfillmentType && (
                          <span className={`badge text-xs ${q.fulfillmentType === 'pickup' ? 'bg-cyan-100 text-cyan-700' : 'bg-blue-100 text-blue-700'}`}>
                            {q.fulfillmentType === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick status update buttons */}
                    {nextButtons.length > 0 && (
                      <div className="flex gap-2 mt-3 flex-wrap">
                        {nextButtons.map(btn => (
                          <button key={btn.nextStatus}
                            onClick={() => updateStatus(q._id, btn.nextStatus)}
                            disabled={updatingId === q._id}
                            className={`${btn.color} text-white text-xs px-3 py-1.5 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50`}>
                            {updatingId === q._id ? '…' : btn.label}
                          </button>
                        ))}
                        <Link to={`/pharmacy/requests/${q._id}`}
                          className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:border-gray-400">
                          <Eye className="w-3 h-3" /> View Detail
                        </Link>
                      </div>
                    )}

                    {/* For pending/submitted — just show view button */}
                    {!nextButtons.length && (
                      <div className="flex gap-2 mt-3">
                        <Link to={`/pharmacy/requests/${q._id}`}
                          className="flex items-center gap-1.5 text-xs btn-secondary py-1.5 px-3">
                          <Eye className="w-3 h-3" />
                          {q.orderStatus === 'pending' ? 'View & Submit Quote' : 'View Details'}
                        </Link>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
