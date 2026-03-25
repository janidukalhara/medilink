import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ClipboardList, DollarSign, TrendingUp, Package,
  Eye, AlertCircle, CheckCircle, Loader2, Activity
} from 'lucide-react';
import { quotationAPI, analyticsAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

// Quick status update config for active orders
const NEXT_STATUS: Record<string, { label: string; next: string; color: string }> = {
  accepted:     { label: '📦 Confirm',        next: 'confirmed',    color: 'bg-teal-600' },
  confirmed:    { label: '🧴 Start Preparing', next: 'preparing',    color: 'bg-orange-500' },
  dispatched:   { label: '✅ Mark Delivered',  next: 'delivered',    color: 'bg-green-600' },
  pickup_ready: { label: '✅ Mark Picked Up',  next: 'picked_up',    color: 'bg-green-600' },
};

export default function PharmacyDashboard() {
  const { user } = useAuth();
  const socket   = useSocket();

  const [pendingReqs, setPendingReqs]   = useState<any[]>([]);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [analytics, setAnalytics]       = useState<any>(null);
  const [loading, setLoading]           = useState(true);
  const [updatingId, setUpdatingId]     = useState<string | null>(null);

  const load = async () => {
    try {
      const [pendRes, activeRes, analyticsRes] = await Promise.all([
        quotationAPI.getPharmacyRequests({ status: 'pending', limit: 5 }),
        quotationAPI.getPharmacyRequests({ status: 'all', limit: 20 }),
        analyticsAPI.pharmacy(),
      ]);

      setPendingReqs(pendRes.data.quotations);

      // Filter active orders (accepted through pickup_ready)
      const activeStatuses = ['accepted','confirmed','preparing','dispatched','pickup_ready'];
      const active = activeRes.data.quotations.filter((q: any) => {
        const st = q.orderStatus || q.status;
        return activeStatuses.includes(st);
      });
      setActiveOrders(active.slice(0, 5));
      setAnalytics(analyticsRes.data);
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally { setLoading(false); }
  };

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (!socket) return;
    socket.on('new_quote_request', () => {
      load();
      toast.success('New prescription request!', { icon: '📋' });
    });
    socket.on('quotation_accepted', () => {
      load();
      toast.success('A patient accepted your quote! 🎉');
    });
    return () => {
      socket.off('new_quote_request');
      socket.off('quotation_accepted');
    };
  }, [socket]);

  const quickUpdate = async (qId: string, nextStatus: string) => {
    setUpdatingId(qId);
    try {
      await quotationAPI.updateStatus(qId, nextStatus);
      toast.success(`✅ Updated to: ${nextStatus.replace(/_/g, ' ')}`);
      await load();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Update failed');
    } finally { setUpdatingId(null); }
  };

  // Pending approval screen
  if (!user?.isApproved) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="text-center card max-w-md p-8">
          <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="w-8 h-8 text-yellow-500" />
          </div>
          <h2 className="text-xl font-bold mb-2">Account Pending Approval</h2>
          <p className="text-gray-500 text-sm">
            Your pharmacy account is awaiting admin approval. You will receive a notification once approved.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  const stats = [
    { label: 'Total Quotes',    value: analytics?.totalQuotes  ?? 0,  icon: ClipboardList, color: 'bg-blue-50   text-blue-600' },
    { label: 'Accepted',        value: analytics?.accepted     ?? 0,  icon: CheckCircle,   color: 'bg-green-50  text-green-600' },
    { label: 'Active Orders',   value: analytics?.activeOrders ?? 0,  icon: Activity,      color: 'bg-orange-50 text-orange-600' },
    { label: 'Revenue (LKR)',   value: Number(analytics?.revenue ?? 0).toLocaleString(), icon: DollarSign, color: 'bg-teal-50 text-teal-600' },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-display font-bold">Welcome, {user?.name}! 🏥</h1>
        <p className="text-sm text-gray-500">Pharmacy dashboard · Manage requests and orders</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(stat => (
          <div key={stat.label} className="card flex items-center gap-3">
            <div className={`p-2.5 rounded-xl ${stat.color}`}>
              <stat.icon className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xl font-bold text-gray-900">{stat.value}</p>
              <p className="text-xs text-gray-500">{stat.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        {/* ── Pending requests ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-primary-500" />
              Pending Requests
              {pendingReqs.length > 0 && (
                <span className="badge bg-red-100 text-red-600">{pendingReqs.length}</span>
              )}
            </h2>
            <Link to="/pharmacy/requests" className="text-xs text-primary-600 hover:underline">View all →</Link>
          </div>

          {pendingReqs.length === 0 ? (
            <div className="text-center py-8">
              <ClipboardList className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No pending requests</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {pendingReqs.map(q => (
                <Link to={`/pharmacy/requests/${q._id}`} key={q._id}
                  className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-gray-100 rounded-xl transition-colors">
                  {q.prescription?.imageUrl && (
                    <img src={q.prescription.imageUrl} alt="Rx"
                      className="w-11 h-11 object-cover rounded-lg border flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-gray-900 truncate">{q.patient?.name}</p>
                    <p className="text-xs text-gray-400">
                      {q.prescription?.extractedMedicines?.length || 0} medicines ·{' '}
                      {format(new Date(q.createdAt), 'MMM d, h:mm a')}
                    </p>
                    {q.prescription?.isUrgent && (
                      <span className="text-xs text-red-500 font-medium">🚨 Urgent</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <StatusBadge status={q.orderStatus || q.status || 'pending'} />
                    <Eye className="w-3.5 h-3.5 text-gray-400" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* ── Active orders ── */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-500" />
              Active Orders
              {activeOrders.length > 0 && (
                <span className="badge bg-orange-100 text-orange-600">{activeOrders.length}</span>
              )}
            </h2>
            <Link to="/pharmacy/requests?tab=active" className="text-xs text-primary-600 hover:underline">View all →</Link>
          </div>

          {activeOrders.length === 0 ? (
            <div className="text-center py-8">
              <Package className="w-10 h-10 text-gray-200 mx-auto mb-2" />
              <p className="text-sm text-gray-400">No active orders</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {activeOrders.map(q => {
                const st         = q.orderStatus || q.status || 'pending';
                const nextAction = NEXT_STATUS[st];
                return (
                  <div key={q._id} className="p-3 bg-gray-50 rounded-xl">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{q.patient?.name}</p>
                        <p className="text-xs text-gray-400">
                          {q.prescription?.extractedMedicines?.length || 0} medicines ·
                          LKR {q.totalAmount?.toFixed(0) || '—'}
                        </p>
                      </div>
                      <StatusBadge status={st} />
                    </div>
                    <div className="flex gap-2">
                      {nextAction && (
                        <button
                          onClick={() => quickUpdate(q._id, nextAction.next)}
                          disabled={updatingId === q._id}
                          className={`${nextAction.color} text-white text-xs px-3 py-1.5 rounded-lg font-medium flex items-center gap-1 disabled:opacity-60`}>
                          {updatingId === q._id
                            ? <Loader2 className="w-3 h-3 animate-spin" />
                            : nextAction.label}
                        </button>
                      )}
                      {/* preparing has two options */}
                      {st === 'preparing' && (
                        <>
                          <button onClick={() => quickUpdate(q._id, 'dispatched')} disabled={updatingId === q._id}
                            className="bg-blue-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60">
                            🚚 Dispatch
                          </button>
                          <button onClick={() => quickUpdate(q._id, 'pickup_ready')} disabled={updatingId === q._id}
                            className="bg-cyan-600 text-white text-xs px-3 py-1.5 rounded-lg font-medium disabled:opacity-60">
                            🏪 Pickup Ready
                          </button>
                        </>
                      )}
                      <Link to={`/pharmacy/requests/${q._id}`}
                        className="text-xs px-2.5 py-1.5 rounded-lg border border-gray-200 text-gray-500 hover:border-gray-400">
                        <Eye className="w-3 h-3" />
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
