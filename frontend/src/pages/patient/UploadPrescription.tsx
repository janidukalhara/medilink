import { useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { Upload, FileImage, X, Brain, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/utils/api'

export default function UploadPrescription() {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [uploading, setUploading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const navigate = useNavigate()

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0]
    if (!f) return
    setFile(f)
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f))
    } else {
      setPreview(null)
    }
    setResult(null)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  })

  const handleUpload = async () => {
    if (!file) return toast.error('Please select a file')
    setUploading(true)
    try {
      const formData = new FormData()
      formData.append('prescription', file)
      if (notes) formData.append('patientNotes', notes)

      const res = await api.post('/prescriptions/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      toast.success('Prescription uploaded! AI is processing...')
      setResult(res.data)

      // Navigate after short delay
      setTimeout(() => navigate('/patient/prescriptions'), 2000)
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-slate-800">Upload Prescription</h1>
        <p className="text-slate-500 text-sm mt-0.5">Upload a clear photo or PDF of your prescription</p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`card p-8 border-2 border-dashed cursor-pointer transition-all text-center ${
          isDragActive
            ? 'border-primary-400 bg-primary-50'
            : 'border-slate-200 hover:border-primary-300 hover:bg-slate-50'
        }`}
      >
        <input {...getInputProps()} />
        {preview ? (
          <div className="relative inline-block">
            <img src={preview} alt="Preview" className="max-h-48 rounded-xl object-contain mx-auto" />
            <button
              onClick={(e) => { e.stopPropagation(); setFile(null); setPreview(null) }}
              className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600"
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        ) : file ? (
          <div className="flex items-center justify-center gap-3">
            <FileImage className="w-12 h-12 text-primary-500" />
            <div className="text-left">
              <p className="font-medium text-slate-700">{file.name}</p>
              <p className="text-sm text-slate-400">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
          </div>
        ) : (
          <>
            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-600 font-medium">
              {isDragActive ? 'Drop your prescription here' : 'Drag & drop your prescription'}
            </p>
            <p className="text-sm text-slate-400 mt-1">or click to browse</p>
            <p className="text-xs text-slate-300 mt-2">JPG, PNG, PDF up to 10MB</p>
          </>
        )}
      </div>

      {/* Notes */}
      <div>
        <label className="label">Patient Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className="input-field resize-none h-20"
          placeholder="Any special instructions or notes for the pharmacy..."
        />
      </div>

      {/* AI Info */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <Brain className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
        <div>
          <p className="text-sm font-medium text-blue-800">AI-Powered OCR Analysis</p>
          <p className="text-xs text-blue-600 mt-0.5">
            Our AI will automatically extract medicine names, dosages, and frequencies.
            Processing takes 10–30 seconds.
          </p>
        </div>
      </div>

      {/* Success */}
      {result && (
        <div className="flex items-start gap-3 p-4 bg-emerald-50 rounded-xl border border-emerald-100">
          <CheckCircle2 className="w-5 h-5 text-emerald-500 mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-emerald-800">Upload Successful!</p>
            <p className="text-xs text-emerald-600">Redirecting to your prescriptions...</p>
          </div>
        </div>
      )}

      <button
        onClick={handleUpload}
        disabled={!file || uploading}
        className="btn-primary w-full py-3 text-base"
      >
        {uploading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Uploading & Processing...
          </>
        ) : (
          <>
            <Upload className="w-4 h-4" />
            Upload & Analyze
          </>
        )}
      </button>
    </div>
  )
}
