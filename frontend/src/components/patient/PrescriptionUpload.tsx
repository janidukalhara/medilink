import React, { useState, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileImage, X, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { prescriptionAPI } from '../../services/api';
import { useSocket } from '../../context/SocketContext';

interface Props { onSuccess?: (prescription: any) => void; }

export default function PrescriptionUpload({ onSuccess }: Props) {
  const socket = useSocket();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [isUrgent, setIsUrgent] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'done' | 'error'>('idle');
  const [result, setResult] = useState<any>(null);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    const f = acceptedFiles[0];
    if (!f) return;
    setFile(f);
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'image/*': ['.jpg', '.jpeg', '.png', '.webp'], 'application/pdf': ['.pdf'] },
    maxFiles: 1,
    maxSize: 10 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setStatus('uploading');

    const fd = new FormData();
    fd.append('prescription', file);
    fd.append('notes', notes);
    fd.append('isUrgent', String(isUrgent));

    try {
      const { data } = await prescriptionAPI.upload(fd);
      setStatus('processing');
      toast.success('Prescription uploaded! AI is processing...');

      // Listen for real-time result
      if (socket) {
        socket.once('prescription_processed', (data: any) => {
          setStatus('done');
          setResult(data);
          toast.success(`✅ ${data.medicines?.length || 0} medicines extracted!`);
          onSuccess?.(data);
        });
        socket.once('prescription_failed', () => {
          setStatus('error');
          toast.error('OCR processing failed. Please try again.');
        });
      } else {
        // Fallback: just navigate after delay
        setTimeout(() => { setStatus('done'); onSuccess?.(data.prescription); }, 3000);
      }
    } catch (err: any) {
      setStatus('error');
      toast.error(err.response?.data?.error || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const reset = () => {
    setFile(null); setPreview(null); setNotes('');
    setIsUrgent(false); setStatus('idle'); setResult(null);
  };

  return (
    <div className="space-y-4">
      {status === 'idle' || status === 'error' ? (
        <>
          {/* Drop Zone */}
          <div
            {...getRootProps()}
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
              isDragActive ? 'border-primary-500 bg-primary-50' : 'border-gray-300 hover:border-primary-400 hover:bg-gray-50'
            }`}
          >
            <input {...getInputProps()} />
            {preview ? (
              <div className="relative inline-block">
                <img src={preview} alt="Preview" className="max-h-48 mx-auto rounded-lg shadow" />
                <button onClick={e => { e.stopPropagation(); reset(); }}
                  className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ) : (
              <div>
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-base font-medium text-gray-700">
                  {isDragActive ? 'Drop here!' : 'Drag & drop prescription image'}
                </p>
                <p className="text-sm text-gray-500 mt-1">or click to browse • JPG, PNG, PDF • Max 10MB</p>
              </div>
            )}
          </div>

          {file && (
            <div className="flex items-center gap-2 p-3 bg-green-50 rounded-lg text-sm text-green-700">
              <FileImage className="w-4 h-4" />
              <span className="truncate">{file.name}</span>
              <span className="text-xs text-gray-500 ml-auto">{(file.size / 1024).toFixed(0)} KB</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              className="input resize-none" rows={2}
              placeholder="Any special instructions for the pharmacist..."
              value={notes} onChange={e => setNotes(e.target.value)}
            />
          </div>

          <div className="flex items-center gap-2">
            <input type="checkbox" id="urgent" checked={isUrgent} onChange={e => setIsUrgent(e.target.checked)} className="w-4 h-4" />
            <label htmlFor="urgent" className="text-sm text-gray-700">🚨 Mark as urgent</label>
          </div>

          <button onClick={handleUpload} disabled={!file || uploading} className="btn-primary w-full py-3 text-base font-semibold">
            <Upload className="w-5 h-5 inline mr-2" />
            Upload & Analyze Prescription
          </button>
        </>
      ) : status === 'uploading' || status === 'processing' ? (
        <div className="text-center py-12">
          <Loader2 className="w-12 h-12 text-primary-600 animate-spin mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-800">
            {status === 'uploading' ? 'Uploading prescription...' : '🤖 AI is analyzing your prescription...'}
          </h3>
          <p className="text-sm text-gray-500 mt-1">
            {status === 'uploading' ? 'Please wait' : 'Running OCR + NLP extraction. This may take up to 30 seconds.'}
          </p>
          {status === 'processing' && (
            <div className="mt-4 space-y-2 text-sm text-gray-600">
              <div className="flex items-center justify-center gap-2"><CheckCircle className="w-4 h-4 text-green-500" /> Image uploaded successfully</div>
              <div className="flex items-center justify-center gap-2"><Loader2 className="w-4 h-4 text-primary-500 animate-spin" /> Running OCR extraction...</div>
            </div>
          )}
        </div>
      ) : status === 'done' ? (
        <div className="text-center py-8">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-800">Prescription processed!</h3>
          {result?.medicines && (
            <p className="text-sm text-gray-600 mt-1">{result.medicines.length} medicine(s) extracted successfully.</p>
          )}
          <div className="flex gap-3 mt-4 justify-center">
            <button onClick={reset} className="btn-secondary">Upload Another</button>
            <button onClick={() => onSuccess?.(result)} className="btn-primary">View Results</button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
