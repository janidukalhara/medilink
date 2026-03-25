import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CheckCircle, XCircle, Truck, Clock, Package } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/utils/api'
import { formatDistanceToNow } from 'date-fns'

export default function PatientQuotations() {
  const queryClient = useQueryClient()

  // Get prescriptions that have received quotes
  const { data: prescriptionsData } = useQuery({
    queryKey: ['prescriptions-with-quotes'],
    queryFn: async () => (await api.get('/prescriptions?status=quotes_received&limit=20')).data,
  })

  const acceptMutation = useMutation({
    mutationFn: (id: string) => api.patch(`/quotations/${id}/accept`),
    onSuccess: () => {
      toast.success('Quotation accepted! Pharmacy will prepare your order.')
      queryClient.invalidateQueries({ queryKey: ['prescriptions-with-quotes'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to accept'),
  })

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.patch(`/quotations/${id}/reject`, { reason }),
    onSuccess: () => {
      toast.success('Quotation rejected.')
      queryClient.invalidateQueries({ queryKey: ['prescriptions-with-quotes'] })
    },
    onError: (err: any) => toast.error(err.response?.data?.error || 'Failed to reject'),
  })

  const prescriptions = prescriptionsData?.prescriptions || []

  return (
    <div className="space-y-6 animate-fade-in">
      <h1 className="text-2xl font-bold text-slate-800">Quotations</h1>

      {prescriptions.length === 0 && (
        <div className="card p-12 text-center">
          <Package className="w-12 h-12 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500">No quotations received yet</p>
          <p className="text-sm text-slate-400 mt-1">Upload a prescription and request quotes from pharmacies</p>
        </div>
      )}

      {prescriptions.map((prescription: any) => (
        <PrescriptionQuotes
          key={prescription._id}
          prescription={prescription}
          onAccept={(id) => acceptMutation.mutate(id)}
          onReject={(id) => rejectMutation.mutate({ id })}
        />
      ))}
    </div>
  )
}

function PrescriptionQuotes({
  prescription, onAccept, onReject
}: {
  prescription: any
  onAccept: (id: string) => void
  onReject: (id: string) => void
}) {
  const { data } = useQuery({
    queryKey: ['quotations', prescription._id],
    queryFn: async () => (await api.get(`/quotations/prescription/${prescription._id}`)).data,
  })

  const quotations = data?.quotations || []

  return (
    <div className="card">
      <div className="p-5 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-slate-100 rounded-xl overflow-hidden">
            {prescription.imageUrl && (
              <img src={prescription.imageUrl} alt="Rx" className="w-full h-full object-cover" />
            )}
          </div>
          <div>
            <p className="font-semibold text-slate-800">
              {prescription.extractedMedicines?.length || 0} medicine(s)
            </p>
            <p className="text-xs text-slate-400">
              {quotations.length} quote(s) received •{' '}
              {formatDistanceToNow(new Date(prescription.createdAt), { addSuffix: true })}
            </p>
          </div>
        </div>
      </div>

      <div className="divide-y divide-slate-50">
        {quotations.map((q: any) => (
          <div key={q._id} className="p-5">
            <div className="flex items-start justify-between mb-3">
              <div>
                <p className="font-semibold text-slate-800">
                  {q.pharmacy?.pharmacyProfile?.pharmacyName || q.pharmacy?.name}
                </p>
                <div className="flex items-center gap-3 text-xs text-slate-500 mt-0.5">
                  {q.deliveryAvailable && (
                    <span className="flex items-center gap-1">
                      <Truck className="w-3 h-3" /> Delivery available
                    </span>
                  )}
                  {q.estimatedReadyTime && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" /> Ready in {q.estimatedReadyTime}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-slate-800">
                  LKR {q.totalAmount?.toFixed(2)}
                </p>
                {q.deliveryFee > 0 && (
                  <p className="text-xs text-slate-400">+ LKR {q.deliveryFee} delivery</p>
                )}
              </div>
            </div>

            {/* Medicine items */}
            <div className="bg-slate-50 rounded-xl p-3 mb-3">
              {q.items?.slice(0, 5).map((item: any, i: number) => (
                <div key={i} className="flex justify-between text-sm py-0.5">
                  <span className={`text-slate-600 ${!item.available ? 'line-through text-slate-400' : ''}`}>
                    {item.medicineName}
                    {item.dosage && <span className="text-slate-400 ml-1">{item.dosage}</span>}
                    {!item.available && item.substituteAvailable && (
                      <span className="text-amber-600 ml-1">(→ {item.substituteName})</span>
                    )}
                  </span>
                  <span className="text-slate-700 font-medium">
                    {item.available ? `LKR ${(item.unitPrice * item.quantity).toFixed(2)}` : 'N/A'}
                  </span>
                </div>
              ))}
            </div>

            {q.status === 'pending' && (
              <div className="flex gap-2">
                <button
                  onClick={() => onAccept(q._id)}
                  className="btn-primary flex-1 py-2"
                >
                  <CheckCircle className="w-4 h-4" /> Accept Quote
                </button>
                <button
                  onClick={() => onReject(q._id)}
                  className="btn-secondary flex-1 py-2 text-red-500 hover:text-red-600"
                >
                  <XCircle className="w-4 h-4" /> Decline
                </button>
              </div>
            )}
            {q.status === 'accepted' && (
              <span className="badge-green">✓ Accepted</span>
            )}
            {q.status === 'rejected' && (
              <span className="badge-red">Declined</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
