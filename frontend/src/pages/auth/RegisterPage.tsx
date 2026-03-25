import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import { Pill, Loader2, User, Building2 } from 'lucide-react'
import api from '@/utils/api'
import { useAuthStore } from '@/store/authStore'

const SL_DISTRICTS = [
  'Colombo','Gampaha','Kalutara','Kandy','Matale','Nuwara Eliya',
  'Galle','Matara','Hambantota','Jaffna','Kilinochchi','Mannar',
  'Mullaitivu','Vavuniya','Puttalam','Kurunegala','Anuradhapura',
  'Polonnaruwa','Badulla','Monaragala','Ratnapura','Kegalle',
  'Trincomalee','Batticaloa','Ampara'
]

const SL_PROVINCES = [
  'Western','Central','Southern','Northern','Eastern',
  'North Western','North Central','Uva','Sabaragamuwa'
]

const baseSchema = z.object({
  name: z.string().min(2, 'Name required'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Minimum 8 characters'),
  phone: z.string().optional(),
  role: z.enum(['patient', 'pharmacy']),
  // Address fields
  addressLine1: z.string().min(3, 'Address required'),
  city: z.string().min(2, 'City required'),
  district: z.string().min(1, 'District required'),
  province: z.string().min(1, 'Province required'),
  postalCode: z.string().optional(),
  gramaNiladhariDivision: z.string().min(2, 'Grama Niladhari Division is required'),
  gramaNiladhariNumber: z.string().optional(),
})

const patientSchema = baseSchema.extend({
  gender: z.enum(['male', 'female', 'other']).optional(),
  nic: z.string().optional(),
  bloodGroup: z.string().optional(),
})

const pharmacySchema = baseSchema.extend({
  pharmacyName: z.string().min(2, 'Pharmacy name required'),
  registrationNumber: z.string().min(2, 'Registration number required'),
  licenseNumber: z.string().optional(),
  deliveryAvailable: z.boolean().default(false),
})

export default function RegisterPage() {
  const [searchParams] = useSearchParams()
  const defaultRole = (searchParams.get('role') as 'patient' | 'pharmacy') || 'patient'
  const [role, setRole] = useState<'patient' | 'pharmacy'>(defaultRole)
  const { setAuth } = useAuthStore()
  const navigate = useNavigate()

  const schema = role === 'patient' ? patientSchema : pharmacySchema
  const { register, handleSubmit, formState: { errors, isSubmitting }, setValue, watch } = useForm<any>({
    resolver: zodResolver(schema),
    defaultValues: { role },
  })

  const onSubmit = async (data: any) => {
    try {
      const address = {
        line1: data.addressLine1,
        city: data.city,
        district: data.district,
        province: data.province,
        postalCode: data.postalCode,
        gramaNiladhariDivision: data.gramaNiladhariDivision,
        gramaNiladhariNumber: data.gramaNiladhariNumber,
      }

      const payload: any = {
        name: data.name,
        email: data.email,
        password: data.password,
        phone: data.phone,
        role,
      }

      if (role === 'patient') {
        payload.patientAddress = address
        payload.gender = data.gender
        payload.nic = data.nic
        payload.bloodGroup = data.bloodGroup
      } else {
        payload.pharmacyAddress = address
        payload.pharmacyName = data.pharmacyName
        payload.registrationNumber = data.registrationNumber
        payload.licenseNumber = data.licenseNumber
        payload.deliveryAvailable = data.deliveryAvailable
      }

      const res = await api.post('/auth/register', payload)
      setAuth(res.data.user, res.data.accessToken, res.data.refreshToken)

      if (role === 'pharmacy') {
        toast.success('Account created! Awaiting admin approval.')
        navigate('/login')
      } else {
        toast.success('Account created successfully!')
        navigate('/patient/dashboard')
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Registration failed')
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-primary-950 to-slate-900 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-primary-600 rounded-2xl mb-4">
            <Pill className="w-6 h-6 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create account</h1>
          <p className="text-slate-400 mt-1 text-sm">Join MediLink today</p>
        </div>

        <div className="bg-white rounded-2xl p-8 shadow-xl">
          {/* Role toggle */}
          <div className="flex gap-2 p-1 bg-slate-100 rounded-xl mb-6">
            {(['patient', 'pharmacy'] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => { setRole(r); setValue('role', r) }}
                className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  role === r ? 'bg-white shadow text-primary-700' : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {r === 'patient' ? <User className="w-4 h-4" /> : <Building2 className="w-4 h-4" />}
                {r === 'patient' ? 'Patient' : 'Pharmacy'}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            {/* Basic fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Full Name *</label>
                <input {...register('name')} className="input-field" placeholder="Your name" />
                {errors.name && <p className="text-red-500 text-xs mt-1">{(errors.name as any).message}</p>}
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label">Phone</label>
                <input {...register('phone')} className="input-field" placeholder="07X XXXXXXX" />
              </div>
            </div>

            <div>
              <label className="label">Email *</label>
              <input {...register('email')} type="email" className="input-field" placeholder="you@example.com" />
              {errors.email && <p className="text-red-500 text-xs mt-1">{(errors.email as any).message}</p>}
            </div>

            <div>
              <label className="label">Password *</label>
              <input {...register('password')} type="password" className="input-field" placeholder="Min 8 characters" />
              {errors.password && <p className="text-red-500 text-xs mt-1">{(errors.password as any).message}</p>}
            </div>

            {/* Pharmacy-specific */}
            {role === 'pharmacy' && (
              <>
                <div>
                  <label className="label">Pharmacy Name *</label>
                  <input {...register('pharmacyName')} className="input-field" placeholder="ABC Medical Center" />
                  {errors.pharmacyName && <p className="text-red-500 text-xs mt-1">{(errors.pharmacyName as any).message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">NMRA Registration No. *</label>
                    <input {...register('registrationNumber')} className="input-field" placeholder="NMRA/PH/..." />
                    {errors.registrationNumber && <p className="text-red-500 text-xs mt-1">{(errors.registrationNumber as any).message}</p>}
                  </div>
                  <div>
                    <label className="label">License No.</label>
                    <input {...register('licenseNumber')} className="input-field" placeholder="LIC/..." />
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                  <input {...register('deliveryAvailable')} type="checkbox" className="rounded" />
                  Delivery available
                </label>
              </>
            )}

            {/* Patient-specific */}
            {role === 'patient' && (
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="label">Gender</label>
                  <select {...register('gender')} className="input-field">
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="label">Blood Group</label>
                  <select {...register('bloodGroup')} className="input-field">
                    <option value="">Select</option>
                    {['A+','A-','B+','B-','AB+','AB-','O+','O-'].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="label">NIC No.</label>
                  <input {...register('nic')} className="input-field" placeholder="NIC" />
                </div>
              </div>
            )}

            {/* Address section */}
            <div className="pt-2 border-t border-slate-100">
              <p className="text-sm font-semibold text-slate-700 mb-3">📍 Address Details</p>
              <div className="space-y-4">
                <div>
                  <label className="label">Address Line 1 *</label>
                  <input {...register('addressLine1')} className="input-field" placeholder="House No, Street Name" />
                  {errors.addressLine1 && <p className="text-red-500 text-xs mt-1">{(errors.addressLine1 as any).message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">City *</label>
                    <input {...register('city')} className="input-field" placeholder="Colombo" />
                    {errors.city && <p className="text-red-500 text-xs mt-1">{(errors.city as any).message}</p>}
                  </div>
                  <div>
                    <label className="label">Postal Code</label>
                    <input {...register('postalCode')} className="input-field" placeholder="00100" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">District *</label>
                    <select {...register('district')} className="input-field">
                      <option value="">Select District</option>
                      {SL_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {errors.district && <p className="text-red-500 text-xs mt-1">{(errors.district as any).message}</p>}
                  </div>
                  <div>
                    <label className="label">Province *</label>
                    <select {...register('province')} className="input-field">
                      <option value="">Select Province</option>
                      {SL_PROVINCES.map(p => <option key={p} value={p}>{p}</option>)}
                    </select>
                    {errors.province && <p className="text-red-500 text-xs mt-1">{(errors.province as any).message}</p>}
                  </div>
                </div>

                {/* ── Grama Niladhari Division ─────────────────────── */}
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl">
                  <p className="text-xs font-medium text-amber-800 mb-2">🏛️ Grama Niladhari Information (Required)</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label">GN Division *</label>
                      <input
                        {...register('gramaNiladhariDivision')}
                        className="input-field"
                        placeholder="e.g. Bambalapitiya"
                      />
                      {errors.gramaNiladhariDivision && (
                        <p className="text-red-500 text-xs mt-1">{(errors.gramaNiladhariDivision as any).message}</p>
                      )}
                    </div>
                    <div>
                      <label className="label">GN Number</label>
                      <input
                        {...register('gramaNiladhariNumber')}
                        className="input-field"
                        placeholder="e.g. GN-COL-001"
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <button type="submit" disabled={isSubmitting} className="btn-primary w-full py-3 text-base mt-2">
              {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already have an account?{' '}
            <Link to="/login" className="text-primary-600 font-medium hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  )
}
