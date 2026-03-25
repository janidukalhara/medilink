import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { Upload, Eye, Send, Brain, AlertTriangle, CheckCircle } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import toast from 'react-hot-toast'
import api from '@/utils/api'

const statusBadge: Record<string, string> = {
  uploaded: 'badge-slate', processed: 'badge-blue', quotes_sent: 'badge-yellow',
  quotes_received: 'badge-purple', accepted: 'badge-green', processing: 'badge-yellow',
  dispatched: 'badge-blue', delivered: 'badge-green', cancelled: 'badge-red',
}

export default function PatientPrescriptions() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['prescriptions'],
    queryFn: async () => (await api.get('/prescriptions?limit=20')).data,
  })

  const requestQuotesMutation = useMutation({
    mutationFn: (id: string) => api.post(`/prescriptions/${id}/request-quotes`),
    onSuccess: (_, id) => {
      toast.success('Quote requests sent to pharmacies!')
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to send requests'),
  })

  const prescriptions = data?.prescriptions || []

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-800">My Prescriptions</h1>
        <Link to="/patient/prescriptions/upload" className="btn-primary">
          <Upload className="w-4 h-4" /> Upload New
        </Link>
      </div>

      {isLoading && (
        <div className="card p-12 text-center text-slate-400">Loading prescriptions...</div>
      )}

      {!isLoading && prescriptions.length === 0 && (
        <div className="card p-12 text-center">
          <Brain className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium">No prescriptions uploaded yet</p>
          <Link to="/patient/prescriptions/upload" className="text-primary-600 text-sm hover:underline mt-2 block">
            Upload your first prescription →
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {prescriptions.map((p: any) => (
          <div key={p._id} className="card p-5">
            <div className="flex items-start gap-4">
              {/* Image thumbnail */}
              <div className="w-16 h-16 bg-slate-100 rounded-xl overflow-hidden shrink-0">
                {p.imageUrl && (
                  <img src={p.imageUrl} alt="Rx" className="w-full h-full object-cover" />
                )}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className={statusBadge[p.status] || 'badge-slate'}>
                    {p.status.replace(/_/g, ' ')}
                  </span>
                  {p.overallConfidence > 0 && (
                    <span className="badge bg-slate-100 text-slate-600">
                      AI: {Math.round(p.overallConfidence * 100)}% confidence
                    </span>
                  )}
                </div>

                {p.extractedMedicines?.length > 0 ? (
                  <div className="mb-2">
                    <p className="text-sm font-medium text-slate-700 mb-1">
                      {p.extractedMedicines.length} medicine(s) extracted:
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {p.extractedMedicines.slice(0, 4).map((m: any, i: number) => (
                        <span key={i} className="badge badge-blue">{m.name}</span>
                      ))}
                      {p.extractedMedicines.length > 4 && (
                        <span className="badge badge-slate">+{p.extractedMedicines.length - 4} more</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-slate-400 mb-2">
                    {p.status === 'uploaded' ? '⏳ AI processing...' : 'No medicines extracted'}
                  </p>
                )}

                {p.warnings?.length > 0 && (
                  <div className="flex items-center gap-1 text-xs text-amber-600">
                    <AlertTriangle className="w-3 h-3" />
                    {p.warnings[0]}
                  </div>
                )}

                <p className="text-xs text-slate-400 mt-1">
                  Uploaded {formatDistanceToNow(new Date(p.createdAt), { addSuffix: true })}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                {p.status === 'processed' && (
                  <button
                    onClick={() => requestQuotesMutation.mutate(p._id)}
                    disabled={requestQuotesMutation.isPending}
                    className="btn-primary text-sm py-2 px-3"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Request Quotes
                  </button>
                )}
                {p.status === 'quotes_received' && (
                  <Link to="/patient/quotations" className="btn-primary text-sm py-2 px-3">
                    <Eye className="w-3.5 h-3.5" />
                    View Quotes
                  </Link>
                )}
                {p.status === 'delivered' && (
                  <span className="flex items-center gap-1 text-emerald-600 text-sm">
                    <CheckCircle className="w-4 h-4" /> Delivered
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
