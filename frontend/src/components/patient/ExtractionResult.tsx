import React, { useState } from 'react';
import {
  Pill, User, Stethoscope, Calendar, AlertTriangle,
  CheckCircle, Edit3, Save, X, ChevronDown, ChevronUp,
  Info, Clock, Package
} from 'lucide-react';
import { prescriptionAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface Medicine {
  name: string; dosage: string; frequency: string; duration: string;
  quantity?: number; instructions: string; confidence: number; category?: string;
}
interface PatientInfo { name?: string; age?: number; gender?: string; }
interface DoctorInfo { name?: string; reg_no?: string; hospital?: string; }
interface WritingStyle {
  style?: string; avg_confidence?: number; readability?: string; is_handwritten?: boolean;
}

interface Props {
  medicines: Medicine[];
  patientInfo?: PatientInfo;
  doctorInfo?: DoctorInfo;
  prescriptionDate?: string;
  writingStyle?: WritingStyle;
  ocrConfidence?: number;
  overallConfidence?: number;
  ocrRawText?: string;
  prescriptionId: string;
  canEdit: boolean;
  onMedicinesUpdated?: (m: Medicine[]) => void;
}

const ConfidenceBar = ({ value }: { value: number }) => {
  const color = value >= 80 ? 'bg-green-500' : value >= 55 ? 'bg-yellow-400' : 'bg-red-400';
  const label = value >= 80 ? 'High' : value >= 55 ? 'Medium' : 'Low';
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-2 rounded-full transition-all ${color}`} style={{ width: `${value}%` }} />
      </div>
      <span className={`text-xs font-medium ${value >= 80 ? 'text-green-600' : value >= 55 ? 'text-yellow-600' : 'text-red-500'}`}>
        {label} ({value.toFixed(0)}%)
      </span>
    </div>
  );
};

const CategoryBadge = ({ cat }: { cat?: string }) => {
  if (!cat) return null;
  const colors: Record<string, string> = {
    Antibiotic: 'bg-blue-100 text-blue-700',
    Analgesic: 'bg-orange-100 text-orange-700',
    NSAID: 'bg-orange-100 text-orange-700',
    Antidiabetic: 'bg-purple-100 text-purple-700',
    Antihypertensive: 'bg-red-100 text-red-700',
    PPI: 'bg-teal-100 text-teal-700',
    Vitamin: 'bg-green-100 text-green-700',
    default: 'bg-gray-100 text-gray-600',
  };
  const color = colors[cat] || colors.default;
  return <span className={`badge ${color}`}>{cat}</span>;
};

export default function ExtractionResult({
  medicines, patientInfo, doctorInfo, prescriptionDate,
  writingStyle, ocrConfidence, overallConfidence, ocrRawText,
  prescriptionId, canEdit, onMedicinesUpdated,
}: Props) {
  const [localMeds, setLocalMeds] = useState<Medicine[]>(medicines);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showRaw, setShowRaw] = useState(false);
  const [expandedIdx, setExpandedIdx] = useState<number | null>(null);

  const updateMed = (i: number, field: keyof Medicine, val: any) => {
    setLocalMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  const addMed = () => {
    setLocalMeds(prev => [...prev, {
      name: 'New Medicine', dosage: '', frequency: '', duration: '',
      quantity: undefined, instructions: '', confidence: 100, category: '',
    }]);
  };

  const removeMed = (i: number) => setLocalMeds(prev => prev.filter((_, idx) => idx !== i));

  const saveMeds = async () => {
    setSaving(true);
    try {
      await prescriptionAPI.updateMedicines(prescriptionId, localMeds);
      toast.success('Medicines updated successfully');
      onMedicinesUpdated?.(localMeds);
      setEditing(false);
    } catch { toast.error('Failed to save'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-4">

      {/* ── AI Summary Card ── */}
      <div className="bg-gradient-to-r from-primary-50 to-teal-50 border border-primary-100 rounded-2xl p-5">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="font-display font-bold text-lg text-gray-900">AI Extraction Summary</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Writing style: <span className="font-medium capitalize">{writingStyle?.style || 'Unknown'}</span>
              {writingStyle?.is_handwritten && ' • Handwritten prescription'}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={`badge ${(overallConfidence || 0) >= 70 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
              {(overallConfidence || 0) >= 70 ? '✅' : '⚠️'} {overallConfidence?.toFixed(0)}% Overall
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-gray-500 mb-1">OCR Confidence</p>
            <ConfidenceBar value={ocrConfidence || 0} />
          </div>
          <div>
            <p className="text-xs text-gray-500 mb-1">NLP Accuracy</p>
            <ConfidenceBar value={
              localMeds.length > 0
                ? Math.round(localMeds.reduce((s, m) => s + m.confidence, 0) / localMeds.length)
                : 0
            } />
          </div>
        </div>
        {writingStyle && (
          <div className="mt-3 flex flex-wrap gap-2 text-xs">
            <span className="px-2 py-1 bg-white rounded-lg border text-gray-600">
              Readability: <b>{writingStyle.readability || 'Unknown'}</b>
            </span>
            <span className="px-2 py-1 bg-white rounded-lg border text-gray-600">
              Words detected: <b>{writingStyle.word_count || '—'}</b>
            </span>
          </div>
        )}
      </div>

      {/* ── Patient & Doctor Info ── */}
      {(patientInfo?.name || patientInfo?.age || doctorInfo?.name || doctorInfo?.hospital || prescriptionDate) && (
        <div className="card">
          <h4 className="font-semibold text-sm text-gray-700 mb-3 flex items-center gap-2">
            <Info className="w-4 h-4 text-primary-500" /> Prescription Information
          </h4>
          <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
            {patientInfo?.name && (
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-gray-400" />
                <div><p className="text-xs text-gray-500">Patient</p><p className="font-medium">{patientInfo.name}</p></div>
              </div>
            )}
            {patientInfo?.age && (
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400" />
                <div><p className="text-xs text-gray-500">Age</p><p className="font-medium">{patientInfo.age} years</p></div>
              </div>
            )}
            {patientInfo?.gender && (
              <div><p className="text-xs text-gray-500">Gender</p><p className="font-medium capitalize">{patientInfo.gender}</p></div>
            )}
            {doctorInfo?.name && (
              <div className="flex items-center gap-2">
                <Stethoscope className="w-4 h-4 text-gray-400" />
                <div><p className="text-xs text-gray-500">Doctor</p><p className="font-medium">Dr. {doctorInfo.name}</p></div>
              </div>
            )}
            {doctorInfo?.reg_no && (
              <div><p className="text-xs text-gray-500">SLMC Reg. No.</p><p className="font-medium">{doctorInfo.reg_no}</p></div>
            )}
            {doctorInfo?.hospital && (
              <div className="col-span-2"><p className="text-xs text-gray-500">Hospital/Clinic</p><p className="font-medium">{doctorInfo.hospital}</p></div>
            )}
            {prescriptionDate && (
              <div><p className="text-xs text-gray-500">Prescription Date</p><p className="font-medium">{prescriptionDate}</p></div>
            )}
          </div>
        </div>
      )}

      {/* ── Medicines ── */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h4 className="font-semibold flex items-center gap-2">
            <Pill className="w-5 h-5 text-primary-600" />
            Extracted Medicines
            <span className="badge bg-primary-100 text-primary-700">{localMeds.length}</span>
          </h4>
          {canEdit && (
            editing ? (
              <div className="flex gap-2">
                <button onClick={addMed} className="text-xs btn-secondary py-1.5 px-2">+ Add</button>
                <button onClick={() => { setLocalMeds(medicines); setEditing(false); }}
                  className="text-xs btn-secondary py-1.5 px-2"><X className="w-3 h-3" /></button>
                <button onClick={saveMeds} disabled={saving}
                  className="text-xs btn-primary py-1.5 px-3">
                  <Save className="w-3 h-3 mr-1" />{saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            ) : (
              <button onClick={() => setEditing(true)} className="text-xs btn-secondary py-1.5 px-3 flex items-center gap-1">
                <Edit3 className="w-3 h-3" /> Edit
              </button>
            )
          )}
        </div>

        {localMeds.length === 0 && (
          <div className="text-center py-8">
            <AlertTriangle className="w-8 h-8 text-yellow-400 mx-auto mb-2" />
            <p className="text-sm text-gray-500">No medicines extracted. Try editing manually or upload a clearer image.</p>
          </div>
        )}

        <div className="space-y-3">
          {localMeds.map((med, i) => (
            <div key={i} className="border border-gray-200 rounded-xl overflow-hidden">
              {/* Header row */}
              <div
                className="flex items-center justify-between p-3 bg-gray-50 cursor-pointer hover:bg-gray-100 transition-colors"
                onClick={() => setExpandedIdx(expandedIdx === i ? null : i)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${med.confidence >= 80 ? 'bg-green-500' : med.confidence >= 55 ? 'bg-yellow-400' : 'bg-red-400'}`} />
                  {editing ? (
                    <input
                      className="input text-sm font-semibold bg-white flex-1"
                      value={med.name}
                      onChange={e => updateMed(i, 'name', e.target.value)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : (
                    <span className="font-semibold text-gray-900 text-sm truncate">{med.name}</span>
                  )}
                  <CategoryBadge cat={med.category} />
                </div>
                <div className="flex items-center gap-3 ml-2 flex-shrink-0">
                  {med.dosage && <span className="text-xs font-medium text-primary-600 bg-primary-50 px-2 py-0.5 rounded-full">{med.dosage}</span>}
                  {editing && (
                    <button onClick={e => { e.stopPropagation(); removeMed(i); }}
                      className="p-1 text-red-500 hover:bg-red-50 rounded">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                  {expandedIdx === i ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </div>
              </div>

              {/* Expanded detail */}
              {(expandedIdx === i || editing) && (
                <div className="p-4 border-t border-gray-100">
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm mb-3">
                    {[
                      { label: '💊 Dosage', field: 'dosage', icon: Pill },
                      { label: '🕒 Frequency', field: 'frequency', icon: Clock },
                      { label: '📅 Duration', field: 'duration', icon: Calendar },
                      { label: '📦 Quantity', field: 'quantity', icon: Package, type: 'number' },
                    ].map(({ label, field, type }) => (
                      <div key={field}>
                        <p className="text-xs text-gray-500 mb-1">{label}</p>
                        {editing ? (
                          <input
                            className="input text-xs"
                            type={type || 'text'}
                            value={(med as any)[field] || ''}
                            onChange={e => updateMed(i, field as keyof Medicine, type === 'number' ? Number(e.target.value) : e.target.value)}
                          />
                        ) : (
                          <p className="text-gray-800 font-medium">{(med as any)[field] || '—'}</p>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="mb-3">
                    <p className="text-xs text-gray-500 mb-1">📋 Instructions</p>
                    {editing ? (
                      <input className="input text-xs" value={med.instructions || ''} onChange={e => updateMed(i, 'instructions', e.target.value)} placeholder="e.g. Take after meals" />
                    ) : (
                      <p className="text-gray-700">{med.instructions || '—'}</p>
                    )}
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">AI Confidence</p>
                    <ConfidenceBar value={med.confidence} />
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* ── Raw OCR Text (collapsible) ── */}
      {ocrRawText && (
        <div className="card">
          <button
            onClick={() => setShowRaw(!showRaw)}
            className="flex items-center justify-between w-full text-sm font-medium text-gray-600"
          >
            <span>📄 Raw OCR Text</span>
            {showRaw ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showRaw && (
            <pre className="mt-3 text-xs text-gray-600 bg-gray-50 rounded-lg p-3 overflow-x-auto whitespace-pre-wrap font-mono leading-relaxed">
              {ocrRawText}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
