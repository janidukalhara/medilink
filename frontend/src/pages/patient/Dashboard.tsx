import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { FileText, Clock, CheckCircle, Package, ChevronRight, Upload, Activity } from 'lucide-react'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'
import { formatDistanceToNow } from 'date-fns'

const statusColors: Record<string, string> = {
  uploaded: 'badge-slate',
  processed: 'badge-blue',
  quotes_sent: 'badge-yellow',
  quotes_received: 'badge-purple',
  accepted: 'badge-green',
  processing: 'badge-yellow',
  dispatched: 'badge-blue',
  delivered: 'badge-green',
  cancelled: 'badge-red',
}

export default function PatientDashboard() {
  const { user } = useAuthStore()

  const { data, isLoading } = useQuery({
    queryKey: ['patient-prescriptions'],
    queryFn: async () => {
      const res = await api.get('/prescriptions?limit=5')
      return res.data
    },
  })

  const prescriptions = data?.prescriptions || []
  const total = data?.total || 0

  const stats = [
    { label: 'Total Prescriptions', value: total, icon: FileText, color: 'text-primary-600', bg: 'bg-primary-50' },
    {
      label: 'Pending Quotes',
      value: prescriptions.filter((p: any) => ['quotes_sent', 'processed'].includes(p.status)).length,
      icon: Clock, color: 'text-amber-600', bg: 'bg-amber-50'
    },
    {
      label: 'Active Orders',
      value: prescriptions.filter((p: any) => ['accepted', 'processing', 'dispatched'].includes(p.status)).length,
      icon: Package, color: 'text-emerald-600', bg: 'bg-emerald-50'
    },
    {
      label: 'Delivered',
      value: prescriptions.filter((p: any) => p.status === 'delivered').length,
      icon: CheckCircle, color: 'text-purple-600', bg: 'bg-purple-50'
    },
  ]

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">
            Good day, {user?.name?.split(' ')[0]} 👋
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">Here's your prescription summary</p>
        </div>
        <Link to="/patient/prescriptions/upload" className="btn-primary">
          <Upload className="w-4 h-4" />
          Upload Prescription
        </Link>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div key={label} className="card p-5">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-10 h-10 ${bg} rounded-xl flex items-center justify-center`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{value}</p>
            <p className="text-sm text-slate-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Recent prescriptions */}
      <div className="card">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-semibold text-slate-800">Recent Prescriptions</h2>
          <Link to="/patient/prescriptions" className="text-sm text-primary-600 hover:underline flex items-center gap-1">
            View all <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
        <div className="divide-y divide-slate-50">
          {isLoading && (
            <div className="p-8 text-center text-slate-400 text-sm">Loading...</div>
          )}
          {!isLoading && prescriptions.length === 0 && (
            <div className="p-8 text-center">
              <Activity className="w-8 h-8 text-slate-300 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">No prescriptions yet</p>
              <Link to="/patient/prescriptions/upload" className="text-primary-600 text-sm hover:underline mt-1 block">
                Upload your first prescription
              </Link>
            </div>
          )}
          {prescriptions.map((p: any) => (
            <div key={p._id} className="p-5 flex items-center gap-4 hover:bg-slate-50 transition-colors">
              <div className="w-10 h-10 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="Rx" className="w-full h-full object-cover" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-slate-700">
                  {p.extractedMedicines?.length
                    ? `${p.extractedMedicines.length} medicine(s) extracted`
                    : p.fileName || 'Prescription'}
                </p>
                <p className="text-xs text-slate-400">
                  {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                </p>
              </div>
              <span className={statusColors[p.status] || 'badge-slate'}>
                {p.status.replace(/_/g, ' ')}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
