import React, { useState } from 'react';
import { Pill, Edit3, Save, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { prescriptionAPI } from '../../services/api';

interface Medicine {
  name: string; dosage: string; frequency: string;
  duration: string; quantity?: number; instructions: string; confidence: number;
}

interface Props {
  medicines: Medicine[];
  prescriptionId: string;
  canEdit: boolean;
  onUpdate?: (medicines: Medicine[]) => void;
}

export default function MedicineList({ medicines, prescriptionId, canEdit, onUpdate }: Props) {
  const [editing, setEditing] = useState(false);
  const [localMeds, setLocalMeds] = useState(medicines);
  const [saving, setSaving] = useState(false);

  const update = (i: number, field: string, val: string) => {
    setLocalMeds(prev => prev.map((m, idx) => idx === i ? { ...m, [field]: val } : m));
  };

  const save = async () => {
    setSaving(true);
    try {
      await prescriptionAPI.updateMedicines(prescriptionId, localMeds);
      toast.success('Medicines updated');
      onUpdate?.(localMeds);
      setEditing(false);
    } catch { toast.error('Failed to update'); }
    finally { setSaving(false); }
  };

  const confidenceColor = (c: number) =>
    c >= 80 ? 'text-green-600 bg-green-50' : c >= 50 ? 'text-yellow-600 bg-yellow-50' : 'text-red-600 bg-red-50';

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-gray-800 flex items-center gap-2">
          <Pill className="w-5 h-5 text-primary-600" />
          Extracted Medicines ({localMeds.length})
        </h3>
        {canEdit && (
          editing ? (
            <div className="flex gap-2">
              <button onClick={() => { setLocalMeds(medicines); setEditing(false); }} className="btn-secondary py-1.5 px-3 text-sm">
                <X className="w-4 h-4" />
              </button>
              <button onClick={save} disabled={saving} className="btn-primary py-1.5 px-3 text-sm">
                <Save className="w-4 h-4 mr-1" />{saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} className="btn-secondary py-1.5 px-3 text-sm">
              <Edit3 className="w-4 h-4 mr-1" />Edit
            </button>
          )
        )}
      </div>

      <div className="space-y-3">
        {localMeds.map((med, i) => (
          <div key={i} className="p-4 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-start justify-between mb-2">
              {editing ? (
                <input
                  className="input font-semibold text-gray-900"
                  value={med.name}
                  onChange={e => update(i, 'name', e.target.value)}
                />
              ) : (
                <h4 className="font-semibold text-gray-900">{med.name}</h4>
              )}
              <span className={`badge ml-2 ${confidenceColor(med.confidence)}`}>
                {med.confidence}% conf.
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-sm">
              {[
                { label: 'Dosage', field: 'dosage' },
                { label: 'Frequency', field: 'frequency' },
                { label: 'Duration', field: 'duration' },
                { label: 'Instructions', field: 'instructions' },
              ].map(({ label, field }) => (
                <div key={field}>
                  <span className="text-xs text-gray-500">{label}</span>
                  {editing ? (
                    <input className="input text-xs mt-0.5" value={(med as any)[field] || ''} onChange={e => update(i, field, e.target.value)} />
                  ) : (
                    <p className="text-gray-700">{(med as any)[field] || '—'}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
