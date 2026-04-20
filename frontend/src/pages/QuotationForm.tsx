import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Zap, Save, Truck, Clock, AlertTriangle,
  CheckCircle, Edit3, Loader2, Package, User, Stethoscope,
  Image, RefreshCw, Plus, Trash2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { quotationAPI, pharmacyAPI } from '../services/api';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import ChatBox from '../components/shared/ChatBox';

export default function QuotationForm() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [quotation, setQuotation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [autoLoading, setAutoLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [items, setItems] = useState<any[]>([]);
  const [deliveryFee, setDeliveryFee] = useState(0);
  const [isDelivery, setIsDelivery] = useState(false);
  const [fulfillmentType, setFulfillmentType] = useState<'delivery' | 'pickup'>('pickup');
  const [estimatedTime, setEstimatedTime] = useState('2–4 hours');
  const [notes, setNotes] = useState('');
  const [autoMatchRate, setAutoMatchRate] = useState<number | null>(null);
  const [tab, setTab] = useState<'quote' | 'prescription' | 'chat'>('prescription');

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await quotationAPI.getById(id!);
        setQuotation(data.quotation);
        // Pre-fill items from prescription medicines
        const meds = data.quotation.prescription?.extractedMedicines || [];
        setItems(meds.map((m: any) => ({
          medicineName: m.name,
          originalName: m.name,
          available: true,
          unitPrice: 0,
          quantity: m.quantity || 1,
          totalPrice: 0,
          substitute: '',
          notes: '',
        })));
        const canDeliver = data.quotation.pharmacy?.pharmacyProfile?.isDeliveryAvailable || false;
        setIsDelivery(canDeliver);
        setFulfillmentType(canDeliver ? 'delivery' : 'pickup');
      } catch (err: any) {
        toast.error('Quotation not found');
        navigate(-1);
      } finally { setLoading(false); }
    };
    load();
  }, [id]);

  // Auto-generate quotation from pharmacy inventory
  const autoGenerate = async () => {
    setAutoLoading(true);
    try {
      const { data } = await pharmacyAPI.autoGenerateQuotation(id!);
      const s = data.summary;
      setItems(s.items);
      setDeliveryFee(s.deliveryFee || 0);
      setIsDelivery(s.isDeliveryAvailable);
      setEstimatedTime(s.estimatedTime || '2–4 hours');
      setAutoMatchRate(s.matchRate);
      toast.success(data.message);
    } catch (err: any) {
      const msg = err.response?.data?.error || '';
      if (msg.includes('No medicines')) {
        toast.error('Add medicines to your prescription first');
      } else {
        toast('No inventory found. Fill in prices manually.', { icon: '⚠️' });
      }
    } finally { setAutoLoading(false); }
  };

  const updateItem = (i: number, field: string, val: any) => {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: val };
      if (field === 'unitPrice' || field === 'quantity') {
        updated.totalPrice = Number(updated.unitPrice) * Number(updated.quantity);
      }
      return updated;
    }));
  };

  const addItem = () => setItems(prev => [...prev, {
    medicineName: '', originalName: '', available: true,
    unitPrice: 0, quantity: 1, totalPrice: 0, substitute: '', notes: '',
  }]);

  const removeItem = (i: number) => setItems(prev => prev.filter((_, idx) => idx !== i));

  const subtotal = items.reduce((s, i) => s + (i.available ? Number(i.totalPrice || 0) : 0), 0);
  const total = subtotal + (fulfillmentType === 'delivery' ? Number(deliveryFee) : 0);

  const submit = async () => {
    const missingPrices = items.filter(i => i.available && Number(i.unitPrice) <= 0);
    if (missingPrices.length > 0) {
      toast.error(`Set prices for: ${missingPrices.map(i => i.medicineName).join(', ')}`);
      return;
    }
    setSubmitting(true);
    try {
      await quotationAPI.submit(id!, {
        items,
        deliveryFee: fulfillmentType === 'delivery' ? Number(deliveryFee) : 0,
        isDeliveryAvailable: fulfillmentType === 'delivery',
        fulfillmentType,
        estimatedTime,
        notes,
      });
      toast.success('✅ Quotation submitted to patient!');
      navigate('/pharmacy/requests');
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to submit');
    } finally { setSubmitting(false); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!quotation) return null;

  const prescription = quotation.prescription;
  const patient = quotation.patient;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back to Requests
      </button>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">Generate Quotation</h1>
          <p className="text-sm text-gray-500">Patient: <strong>{patient?.name}</strong></p>
        </div>
        {quotation.status === 'submitted' && (
          <span className="badge bg-green-100 text-green-700 text-sm px-3 py-1">✅ Already Submitted</span>
        )}
      </div>

      {/* Sub-tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 gap-1">
        {[
          { key: 'prescription', label: 'Prescription Info', icon: Image },
          { key: 'quote', label: 'Build Quote', icon: Package },
          { key: 'chat', label: 'Chat with Patient', icon: Edit3 },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all ${tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── PRESCRIPTION INFO TAB ── */}
      {tab === 'prescription' && (
        <div className="space-y-4">
          <div className="card">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-600 mb-2">📄 Prescription Image</p>
                {prescription?.imageUrl ? (
                  <a href={prescription.imageUrl} target="_blank" rel="noopener noreferrer">
                    <img src={prescription.imageUrl} alt="Prescription" className="rounded-xl border max-h-64 w-full object-contain hover:opacity-90" />
                  </a>
                ) : <div className="h-32 bg-gray-100 rounded-xl flex items-center justify-center text-gray-400 text-sm">No image</div>}
              </div>

              <div className="space-y-3 text-sm">
                {/* Patient info */}
                <div className="p-3 bg-blue-50 rounded-xl">
                  <p className="text-xs font-semibold text-blue-700 mb-2 flex items-center gap-1"><User className="w-3 h-3" /> Patient Info</p>
                  <p className="font-medium">{patient?.name}</p>
                  <p className="text-gray-600">{patient?.phone}</p>
                  {patient?.patientProfile?.district && (
                    <p className="text-gray-500 text-xs mt-1">
                      {patient.patientProfile.district}
                      {patient.patientProfile.gramaNiladhari?.divisionName && ` · GN: ${patient.patientProfile.gramaNiladhari.divisionName}`}
                    </p>
                  )}
                  {prescription?.patientInfoExtracted?.age && (
                    <p className="text-gray-600 text-xs">Age: {prescription.patientInfoExtracted.age} yrs · {prescription.patientInfoExtracted.gender}</p>
                  )}
                </div>

                {/* Doctor info */}
                {(prescription?.doctorName || prescription?.hospitalName) && (
                  <div className="p-3 bg-teal-50 rounded-xl">
                    <p className="text-xs font-semibold text-teal-700 mb-2 flex items-center gap-1"><Stethoscope className="w-3 h-3" /> Doctor Info</p>
                    {prescription.doctorName && <p className="font-medium">Dr. {prescription.doctorName}</p>}
                    {prescription.doctorRegNo && <p className="text-gray-500 text-xs">SLMC: {prescription.doctorRegNo}</p>}
                    {prescription.hospitalName && <p className="text-gray-600 text-xs">{prescription.hospitalName}</p>}
                  </div>
                )}

                {prescription?.isUrgent && (
                  <div className="flex items-center gap-2 p-2 bg-red-50 rounded-lg text-red-700 text-sm">
                    <AlertTriangle className="w-4 h-4" /><span className="font-medium">Urgent prescription</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Extracted medicines summary */}
          <div className="card">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="w-4 h-4 text-primary-600" />
              Extracted Medicines ({prescription?.extractedMedicines?.length || 0})
            </h3>
            <div className="space-y-2">
              {prescription?.extractedMedicines?.map((m: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div>
                    <p className="font-medium text-sm">{m.name}</p>
                    <p className="text-xs text-gray-500">
                      {[m.dosage, m.frequency, m.duration].filter(Boolean).join(' · ')}
                    </p>
                  </div>
                  <div className="text-right text-xs">
                    <p className="text-gray-500">Qty: {m.quantity || 'N/A'}</p>
                    <span className={`badge ${m.confidence >= 80 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                      {m.confidence}% conf
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button onClick={() => setTab('quote')} className="btn-primary w-full py-3 font-semibold">
            → Build Quotation
          </button>
        </div>
      )}

      {/* ── QUOTE BUILDER TAB ── */}
      {tab === 'quote' && (
        <div className="space-y-4">
          {/* Auto-generate banner */}
          <div className="p-4 bg-gradient-to-r from-primary-50 to-teal-50 border border-primary-100 rounded-xl">
            <div className="flex items-start justify-between flex-wrap gap-3">
              <div>
                <p className="font-semibold text-primary-800 flex items-center gap-2">
                  <Zap className="w-4 h-4" /> Auto-Generate from Your Inventory
                </p>
                <p className="text-xs text-primary-600 mt-0.5">
                  Automatically match medicines against your stock database and fill prices.
                </p>
                {autoMatchRate !== null && (
                  <p className="text-xs mt-1 font-medium text-teal-700">
                    ✅ {autoMatchRate}% medicines matched from your inventory
                  </p>
                )}
              </div>
              <button onClick={autoGenerate} disabled={autoLoading}
                className="btn-primary flex items-center gap-2 text-sm flex-shrink-0">
                {autoLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                {autoLoading ? 'Matching...' : 'Auto-Generate'}
              </button>
            </div>
          </div>

          {/* Items table */}
          <div className="card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold">Medicine Items</h3>
              <button onClick={addItem} className="btn-secondary text-xs flex items-center gap-1 py-1.5 px-2">
                <Plus className="w-3 h-3" /> Add Item
              </button>
            </div>

            <div className="space-y-3">
              {items.map((item, i) => (
                <div key={i} className={`p-3 rounded-xl border-2 transition-colors ${item.available ? 'border-gray-200' : 'border-red-100 bg-red-50'}`}>
                  {/* Row 1: name + availability toggle */}
                  <div className="flex items-center gap-2 mb-2">
                    <input type="checkbox" checked={item.available}
                      onChange={e => updateItem(i, 'available', e.target.checked)}
                      className="w-4 h-4 accent-primary-600 flex-shrink-0" />
                    <input
                      className={`input text-sm font-medium flex-1 ${!item.available ? 'line-through text-gray-400' : ''}`}
                      value={item.medicineName}
                      onChange={e => updateItem(i, 'medicineName', e.target.value)}
                      placeholder="Medicine name"
                    />
                    <button onClick={() => removeItem(i)} className="p-1 text-red-400 hover:text-red-600 flex-shrink-0">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {item.available ? (
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-xs text-gray-500">Unit Price (LKR) *</label>
                        <input type="number" min={0} step={0.5}
                          className={`input mt-0.5 text-sm ${item.unitPrice <= 0 ? 'border-red-300' : ''}`}
                          value={item.unitPrice || ''}
                          onChange={e => updateItem(i, 'unitPrice', parseFloat(e.target.value) || 0)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Quantity</label>
                        <input type="number" min={1}
                          className="input mt-0.5 text-sm"
                          value={item.quantity}
                          onChange={e => updateItem(i, 'quantity', parseInt(e.target.value) || 1)} />
                      </div>
                      <div>
                        <label className="text-xs text-gray-500">Total (LKR)</label>
                        <input className="input mt-0.5 text-sm bg-gray-50 text-gray-600" readOnly
                          value={item.totalPrice?.toFixed(2) || '0.00'} />
                      </div>
                      <div className="col-span-3">
                        <label className="text-xs text-gray-500">Substitute / Notes</label>
                        <input className="input mt-0.5 text-xs" placeholder="e.g. Generic available, Paracetamol 500mg instead"
                          value={item.substitute || ''}
                          onChange={e => updateItem(i, 'substitute', e.target.value)} />
                      </div>
                    </div>
                  ) : (
                    <div className="ml-6">
                      <p className="text-xs text-red-600 font-medium">Not in stock</p>
                      <input className="input mt-1 text-xs"
                        placeholder="Suggest substitute medicine..."
                        value={item.substitute || ''}
                        onChange={e => updateItem(i, 'substitute', e.target.value)} />
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Fulfillment & extras */}
          <div className="card space-y-4">
            <h3 className="font-semibold">Fulfillment Options</h3>

            {/* Fulfillment type selector */}
            <div>
              <label className="text-xs font-medium text-gray-600 mb-2 block">How will the patient receive medicines?</label>
              <div className="grid grid-cols-2 gap-3">
                <button type="button"
                  onClick={() => { setFulfillmentType('delivery'); setIsDelivery(true); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    fulfillmentType === 'delivery'
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <Truck className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-semibold">Delivery</p>
                    <p className="text-xs font-normal opacity-70">We deliver to patient</p>
                  </div>
                </button>
                <button type="button"
                  onClick={() => { setFulfillmentType('pickup'); setIsDelivery(false); setDeliveryFee(0); }}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 transition-all text-sm font-medium ${
                    fulfillmentType === 'pickup'
                      ? 'border-teal-500 bg-teal-50 text-teal-700'
                      : 'border-gray-200 text-gray-500 hover:border-gray-300'
                  }`}>
                  <Package className="w-4 h-4" />
                  <div className="text-left">
                    <p className="font-semibold">Pickup</p>
                    <p className="text-xs font-normal opacity-70">Patient collects in store</p>
                  </div>
                </button>
              </div>
            </div>

            {fulfillmentType === 'delivery' && (
              <div>
                <label className="text-xs text-gray-500">Delivery Fee (LKR)</label>
                <input type="number" min={0} className="input mt-0.5 w-40"
                  value={deliveryFee} onChange={e => setDeliveryFee(parseFloat(e.target.value) || 0)} />
              </div>
            )}

            <div>
              <label className="text-xs text-gray-500 flex items-center gap-1"><Clock className="w-3 h-3" /> Estimated Time</label>
              <input className="input mt-0.5 w-48" value={estimatedTime}
                onChange={e => setEstimatedTime(e.target.value)} placeholder="e.g. 2–4 hours" />
            </div>

            <div>
              <label className="text-xs text-gray-500">Notes to Patient (optional)</label>
              <textarea className="input mt-0.5 resize-none w-full" rows={2}
                value={notes} onChange={e => setNotes(e.target.value)}
                placeholder="e.g. Please come to counter 3, Bring your NIC..." />
            </div>

            {/* Totals */}
            <div className="border-t pt-4 space-y-1.5 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>Subtotal</span><span>LKR {subtotal.toFixed(2)}</span>
              </div>
              {fulfillmentType === 'delivery' && deliveryFee > 0 && <div className="flex justify-between text-gray-600">
                <span>Delivery</span><span>LKR {Number(deliveryFee).toFixed(2)}</span>
              </div>}
              <div className="flex justify-between font-bold text-base border-t pt-2">
                <span>Total Amount</span>
                <span className="text-primary-600">LKR {total.toFixed(2)}</span>
              </div>
            </div>
          </div>

          <button onClick={submit} disabled={submitting || items.length === 0}
            className="btn-primary w-full py-3 text-base font-semibold">
            {submitting
              ? <><Loader2 className="w-5 h-5 animate-spin inline mr-2" />Submitting...</>
              : <><Save className="w-5 h-5 inline mr-2" />Submit Quotation to Patient</>
            }
          </button>
        </div>
      )}

      {/* ── CHAT TAB ── */}
      {tab === 'chat' && (
        <ChatBox
          prescriptionId={prescription?._id}
          pharmacyId={quotation?.pharmacy?._id}
          pharmacyName={quotation?.pharmacy?.name || 'Pharmacy'}
        />
      )}
    </div>
  );
}
