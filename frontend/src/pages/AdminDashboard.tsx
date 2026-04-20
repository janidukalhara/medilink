import React, { useState, useEffect } from 'react';
import {
  Users, Activity, CheckCircle, XCircle, BarChart2, Search,
  Trash2, Edit3, Eye, X, Save, Loader2, AlertTriangle,
  Building2, ShieldCheck, UserX, UserCheck, ChevronLeft, ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { adminAPI } from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

type AdminTab = 'dashboard' | 'pharmacies' | 'users';

// ─── Modal: User Details ───────────────────────────────────────────────────────
function UserDetailModal({ user, onClose }: { user: any; onClose: () => void }) {
  if (!user) return null;
  const profile = user.role === 'patient' ? user.patientProfile : user.pharmacyProfile;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">{user.name}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            {[
              ['Email', user.email],
              ['Phone', user.phone],
              ['Role', user.role],
              ['Status', user.isActive ? 'Active' : 'Inactive'],
              ['Approved', user.isApproved ? 'Yes' : 'No'],
              ['Joined', new Date(user.createdAt).toLocaleDateString()],
            ].map(([k, v]) => (
              <div key={k} className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-400 mb-0.5">{k}</p>
                <p className="font-medium capitalize text-gray-800">{v}</p>
              </div>
            ))}
          </div>
          {profile && (
            <div>
              <h3 className="font-semibold text-sm text-gray-700 mb-2">
                {user.role === 'patient' ? 'Patient Profile' : 'Pharmacy Profile'}
              </h3>
              <div className="bg-gray-50 rounded-xl p-4 text-sm space-y-2">
                {user.role === 'pharmacy' && <>
                  {profile.licenseNumber && <p><span className="text-gray-400">License: </span>{profile.licenseNumber}</p>}
                  {profile.registrationNumber && <p><span className="text-gray-400">Reg No: </span>{profile.registrationNumber}</p>}
                  {profile.openHours && <p><span className="text-gray-400">Hours: </span>{profile.openHours}</p>}
                  <p><span className="text-gray-400">Delivery: </span>{profile.isDeliveryAvailable ? 'Yes' : 'No'}</p>
                </>}
                {user.role === 'patient' && <>
                  {profile.dateOfBirth && <p><span className="text-gray-400">DOB: </span>{new Date(profile.dateOfBirth).toLocaleDateString()}</p>}
                  {profile.gender && <p><span className="text-gray-400">Gender: </span><span className="capitalize">{profile.gender}</span></p>}
                </>}
                {profile.address && <p><span className="text-gray-400">Address: </span>{profile.address}</p>}
                {profile.district && <p><span className="text-gray-400">District: </span>{profile.district}{profile.province ? `, ${profile.province}` : ''}</p>}
                {profile.gramaNiladhari?.divisionName && <p><span className="text-gray-400">GN Division: </span>{profile.gramaNiladhari.divisionName}</p>}
                {profile.description && <p><span className="text-gray-400">About: </span>{profile.description}</p>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Modal: Edit Pharmacy ──────────────────────────────────────────────────────
function EditPharmacyModal({ pharmacy, onClose, onSaved }: { pharmacy: any; onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    name: pharmacy.name || '',
    phone: pharmacy.phone || '',
    licenseNumber: pharmacy.pharmacyProfile?.licenseNumber || '',
    registrationNumber: pharmacy.pharmacyProfile?.registrationNumber || '',
    openHours: pharmacy.pharmacyProfile?.openHours || '',
    isDeliveryAvailable: pharmacy.pharmacyProfile?.isDeliveryAvailable || false,
    address: pharmacy.pharmacyProfile?.address || '',
    district: pharmacy.pharmacyProfile?.district || '',
    description: pharmacy.pharmacyProfile?.description || '',
  });
  const [saving, setSaving] = useState(false);

  const save = async () => {
    setSaving(true);
    try {
      await adminAPI.updatePharmacy(pharmacy._id, {
        name: form.name,
        phone: form.phone,
        pharmacyProfile: {
          licenseNumber: form.licenseNumber,
          registrationNumber: form.registrationNumber,
          openHours: form.openHours,
          isDeliveryAvailable: form.isDeliveryAvailable,
          address: form.address,
          district: form.district,
          description: form.description,
        },
      });
      toast.success('Pharmacy updated');
      onSaved();
      onClose();
    } catch { toast.error('Update failed'); }
    finally { setSaving(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="font-bold text-lg">Edit Pharmacy</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded-lg"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-3">
          {[
            { label: 'Name', key: 'name' },
            { label: 'Phone', key: 'phone' },
            { label: 'License Number', key: 'licenseNumber' },
            { label: 'Registration No.', key: 'registrationNumber' },
            { label: 'Open Hours', key: 'openHours' },
            { label: 'Address', key: 'address' },
            { label: 'District', key: 'district' },
          ].map(({ label, key }) => (
            <div key={key}>
              <label className="text-xs font-medium text-gray-600 mb-1 block">{label}</label>
              <input className="input text-sm" value={(form as any)[key]}
                onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))} />
            </div>
          ))}
          <div>
            <label className="text-xs font-medium text-gray-600 mb-1 block">Description</label>
            <textarea className="input text-sm resize-none" rows={2} value={form.description}
              onChange={e => setForm(p => ({ ...p, description: e.target.value }))} />
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="edit-delivery" checked={form.isDeliveryAvailable}
              onChange={e => setForm(p => ({ ...p, isDeliveryAvailable: e.target.checked }))} className="w-4 h-4" />
            <label htmlFor="edit-delivery" className="text-sm text-gray-700">Delivery Available</label>
          </div>
          <button onClick={save} disabled={saving}
            className="btn-primary w-full py-2.5 flex items-center justify-center gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main Admin Dashboard ──────────────────────────────────────────────────────
export default function AdminDashboard() {
  const [tab, setTab] = useState<AdminTab>('dashboard');
  const [stats, setStats] = useState<any>(null);
  const [pendingPharmacies, setPendingPharmacies] = useState<any[]>([]);
  const [allPharmacies, setAllPharmacies] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [pharmSearch, setPharmSearch] = useState('');
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('');
  const [pharmPage, setPharmPage] = useState(1);
  const [userPage, setUserPage] = useState(1);
  const [pharmTotal, setPharmTotal] = useState(0);
  const [userTotal, setUserTotal] = useState(0);
  const [viewUser, setViewUser] = useState<any>(null);
  const [editPharmacy, setEditPharmacy] = useState<any>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      const [dashRes, pendingRes] = await Promise.all([
        adminAPI.getDashboard(),
        adminAPI.getPendingPharmacies(),
      ]);
      setStats(dashRes.data.stats);
      setPendingPharmacies(pendingRes.data.pharmacies);
    } catch { } finally { setLoading(false); }
  };

  const loadPharmacies = async () => {
    try {
      const { data } = await adminAPI.getAllPharmacies({ page: pharmPage, limit: 15, search: pharmSearch });
      setAllPharmacies(data.pharmacies);
      setPharmTotal(data.total);
    } catch { toast.error('Failed to load pharmacies'); }
  };

  const loadUsers = async () => {
    try {
      const params: any = { page: userPage, limit: 15 };
      if (userSearch) params.search = userSearch;
      if (userRoleFilter) params.role = userRoleFilter;
      const { data } = await adminAPI.getUsers(params);
      setUsers(data.users);
      setUserTotal(data.total);
    } catch { toast.error('Failed to load users'); }
  };

  useEffect(() => { loadDashboard(); }, []);
  useEffect(() => { if (tab === 'pharmacies') loadPharmacies(); }, [tab, pharmPage, pharmSearch]);
  useEffect(() => { if (tab === 'users') loadUsers(); }, [tab, userPage, userSearch, userRoleFilter]);

  const approve = async (id: string) => {
    setActionId(id);
    try { await adminAPI.approvePharmacy(id); toast.success('Pharmacy approved!'); loadDashboard(); loadPharmacies(); }
    catch { toast.error('Failed'); } finally { setActionId(null); }
  };

  const reject = async (id: string) => {
    setActionId(id);
    try { await adminAPI.rejectPharmacy(id); toast.success('Pharmacy rejected'); loadDashboard(); loadPharmacies(); }
    catch { toast.error('Failed'); } finally { setActionId(null); }
  };

  const deletePharmacy = async (id: string) => {
    setActionId(id);
    try { await adminAPI.deletePharmacy(id); toast.success('Pharmacy deleted'); setDeleteConfirm(null); loadPharmacies(); loadDashboard(); }
    catch { toast.error('Delete failed'); } finally { setActionId(null); }
  };

  const toggleUser = async (id: string) => {
    setActionId(id);
    try { await adminAPI.toggleUser(id); toast.success('User status updated'); loadUsers(); }
    catch { toast.error('Failed'); } finally { setActionId(null); }
  };

  const viewUserDetail = async (id: string) => {
    try { const { data } = await adminAPI.getUserById(id); setViewUser(data.user); }
    catch { toast.error('Could not load user'); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 space-y-5">
      <div>
        <h1 className="text-2xl font-display font-bold">Admin Panel</h1>
        <p className="text-gray-500 text-sm">MediLink Platform Management</p>
      </div>

      {/* Tab navigation */}
      <div className="flex bg-gray-100 rounded-xl p-1 gap-1 w-fit">
        {([
          { key: 'dashboard', label: 'Dashboard', icon: BarChart2 },
          { key: 'pharmacies', label: 'Pharmacies', icon: Building2, badge: pendingPharmacies.length },
          { key: 'users', label: 'Users', icon: Users },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            <t.icon className="w-4 h-4" />
            {t.label}
            {'badge' in t && t.badge > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-yellow-500 text-white rounded-full leading-none">{t.badge}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD TAB ── */}
      {tab === 'dashboard' && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Patients', value: stats?.totalPatients, icon: Users, color: 'bg-blue-50 text-blue-600' },
              { label: 'Pharmacies', value: stats?.totalPharmacies, icon: Building2, color: 'bg-teal-50 text-teal-600' },
              { label: 'Prescriptions', value: stats?.totalPrescriptions, icon: Activity, color: 'bg-purple-50 text-purple-600' },
              { label: 'OCR Accuracy', value: `${stats?.avgOCRConfidence}%`, icon: ShieldCheck, color: 'bg-green-50 text-green-600' },
            ].map(s => (
              <div key={s.label} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${s.color}`}><s.icon className="w-5 h-5" /></div>
                <div><p className="text-xl font-bold">{s.value}</p><p className="text-xs text-gray-500">{s.label}</p></div>
              </div>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold mb-4">Activity</h2>
              <div className="space-y-3">
                {[
                  { label: 'Prescriptions Today', value: stats?.processedToday, warn: false },
                  { label: 'Pending Approvals', value: stats?.pendingPharmacies, warn: stats?.pendingPharmacies > 0 },
                  { label: 'Failed OCR', value: stats?.failedOCR, warn: stats?.failedOCR > 0 },
                  { label: 'Accepted Quotes', value: stats?.acceptedQuotations, warn: false },
                ].map(row => (
                  <div key={row.label} className="flex justify-between items-center py-2 border-b border-gray-50 last:border-0">
                    <span className="text-sm text-gray-600">{row.label}</span>
                    <span className={`font-bold ${row.warn ? 'text-yellow-600' : 'text-gray-800'}`}>{row.value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Pending approvals quick action */}
            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h2 className="font-semibold mb-4 flex items-center gap-2">
                Pending Approvals
                {pendingPharmacies.length > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">{pendingPharmacies.length}</span>
                )}
              </h2>
              {pendingPharmacies.length === 0 ? (
                <div className="text-center py-6">
                  <CheckCircle className="w-10 h-10 text-green-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-500">All caught up!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {pendingPharmacies.map(p => (
                    <div key={p._id} className="p-3 bg-gray-50 rounded-xl">
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-gray-500">{p.email} · {p.pharmacyProfile?.district}</p>
                      {p.pharmacyProfile?.licenseNumber && (
                        <p className="text-xs text-gray-400">Lic: {p.pharmacyProfile.licenseNumber}</p>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button onClick={() => approve(p._id)} disabled={actionId === p._id}
                          className="flex-1 py-1.5 text-xs bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center justify-center gap-1 disabled:opacity-50">
                          <CheckCircle className="w-3 h-3" /> Approve
                        </button>
                        <button onClick={() => reject(p._id)} disabled={actionId === p._id}
                          className="flex-1 py-1.5 text-xs bg-red-100 text-red-700 rounded-lg hover:bg-red-200 flex items-center justify-center gap-1 disabled:opacity-50">
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
      )}

      {/* ── PHARMACIES TAB ── */}
      {tab === 'pharmacies' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input className="input pl-9 text-sm" placeholder="Search name, email, district, license..."
                value={pharmSearch} onChange={e => { setPharmSearch(e.target.value); setPharmPage(1); }} />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['Pharmacy', 'Contact', 'Location', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {allPharmacies.map(p => (
                  <tr key={p._id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.pharmacyProfile?.licenseNumber || '—'}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600">{p.email}</p>
                      <p className="text-xs text-gray-400">{p.phone}</p>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600">{p.pharmacyProfile?.district || '—'}</p>
                      <p className="text-xs text-gray-400">{p.pharmacyProfile?.gramaNiladhari?.divisionName || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${p.isApproved ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {p.isApproved ? 'Approved' : 'Pending'}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full w-fit ${p.isActive ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-500'}`}>
                          {p.isActive ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        {!p.isApproved && (
                          <button onClick={() => approve(p._id)} disabled={actionId === p._id}
                            className="p-1.5 rounded-lg bg-green-50 text-green-600 hover:bg-green-100" title="Approve">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={() => setEditPharmacy(p)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={() => viewUserDetail(p._id)}
                          className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleUser(p._id)} disabled={actionId === p._id}
                          className={`p-1.5 rounded-lg ${p.isActive ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          title={p.isActive ? 'Deactivate' : 'Activate'}>
                          {p.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                        <button onClick={() => setDeleteConfirm(p._id)}
                          className="p-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {allPharmacies.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-10 text-gray-400 text-sm">No pharmacies found</td></tr>
                )}
              </tbody>
            </table>
            {/* Pagination */}
            {pharmTotal > 15 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Showing {(pharmPage - 1) * 15 + 1}–{Math.min(pharmPage * 15, pharmTotal)} of {pharmTotal}</span>
                <div className="flex gap-1">
                  <button onClick={() => setPharmPage(p => Math.max(1, p - 1))} disabled={pharmPage === 1}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setPharmPage(p => p + 1)} disabled={pharmPage * 15 >= pharmTotal}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── USERS TAB ── */}
      {tab === 'users' && (
        <div className="space-y-4">
          <div className="flex gap-3 flex-wrap">
            <div className="relative flex-1 min-w-48">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
              <input className="input pl-9 text-sm" placeholder="Search name or email..."
                value={userSearch} onChange={e => { setUserSearch(e.target.value); setUserPage(1); }} />
            </div>
            <select className="input text-sm w-36" value={userRoleFilter}
              onChange={e => { setUserRoleFilter(e.target.value); setUserPage(1); }}>
              <option value="">All Roles</option>
              <option value="patient">Patient</option>
              <option value="pharmacy">Pharmacy</option>
              <option value="admin">Admin</option>
            </select>
          </div>

          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  {['User', 'Role', 'Contact', 'Joined', 'Status', 'Actions'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {users.map(u => (
                  <tr key={u._id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-gray-900">{u.name}</p>
                      <p className="text-xs text-gray-400">{u.email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize font-medium ${
                        u.role === 'admin' ? 'bg-red-100 text-red-700'
                        : u.role === 'pharmacy' ? 'bg-teal-100 text-teal-700'
                        : 'bg-blue-100 text-blue-700'
                      }`}>{u.role}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="text-gray-600 text-xs">{u.phone}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {new Date(u.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${u.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                        {u.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={() => viewUserDetail(u._id)}
                          className="p-1.5 rounded-lg bg-gray-50 text-gray-600 hover:bg-gray-100" title="View Details">
                          <Eye className="w-4 h-4" />
                        </button>
                        <button onClick={() => toggleUser(u._id)} disabled={actionId === u._id}
                          className={`p-1.5 rounded-lg ${u.isActive ? 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100' : 'bg-green-50 text-green-600 hover:bg-green-100'}`}
                          title={u.isActive ? 'Deactivate' : 'Activate'}>
                          {u.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {users.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-10 text-gray-400 text-sm">No users found</td></tr>
                )}
              </tbody>
            </table>
            {userTotal > 15 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-xs text-gray-500">
                <span>Showing {(userPage - 1) * 15 + 1}–{Math.min(userPage * 15, userTotal)} of {userTotal}</span>
                <div className="flex gap-1">
                  <button onClick={() => setUserPage(p => Math.max(1, p - 1))} disabled={userPage === 1}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronLeft className="w-4 h-4" /></button>
                  <button onClick={() => setUserPage(p => p + 1)} disabled={userPage * 15 >= userTotal}
                    className="p-1 hover:bg-gray-100 rounded disabled:opacity-40"><ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      {viewUser && <UserDetailModal user={viewUser} onClose={() => setViewUser(null)} />}
      {editPharmacy && (
        <EditPharmacyModal pharmacy={editPharmacy} onClose={() => setEditPharmacy(null)} onSaved={loadPharmacies} />
      )}

      {/* Delete confirm */}
      {deleteConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-100 rounded-xl flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <h3 className="font-bold text-gray-900">Delete Pharmacy?</h3>
            </div>
            <p className="text-sm text-gray-500 mb-5">This action cannot be undone. All associated data will remain but the pharmacy account will be permanently removed.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)} className="flex-1 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50">Cancel</button>
              <button onClick={() => deletePharmacy(deleteConfirm)} disabled={!!actionId}
                className="flex-1 py-2 rounded-xl bg-red-600 text-white text-sm font-medium hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2">
                {actionId ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
