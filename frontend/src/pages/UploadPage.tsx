import React from 'react';
import { useNavigate } from 'react-router-dom';
import PrescriptionUpload from '../components/patient/PrescriptionUpload';
import { ChevronLeft } from 'lucide-react';

export default function UploadPage() {
  const navigate = useNavigate();
  return (
    <div className="max-w-2xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>
      <h1 className="text-xl font-display font-bold mb-1">Upload Prescription</h1>
      <p className="text-sm text-gray-500 mb-6">Upload a photo or scan of your prescription. Our AI will extract the medicine details automatically.</p>
      <div className="card">
        <PrescriptionUpload onSuccess={(data) => navigate(`/patient/prescriptions/${data?.prescriptionId || ''}`)} />
      </div>
    </div>
  );
}
