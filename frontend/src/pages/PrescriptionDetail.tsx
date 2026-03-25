import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ChevronLeft, Image, ShoppingBag, MessageSquare,
  Loader2, AlertTriangle, CheckCircle, MapPin, Send,
  Package, Truck, ShoppingCart
} from 'lucide-react';
import toast from 'react-hot-toast';
import { prescriptionAPI, quotationAPI } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { useSocket } from '../context/SocketContext';
import StatusBadge from '../components/shared/StatusBadge';
import ExtractionResult from '../components/patient/ExtractionResult';
import PharmacySelector from '../components/patient/PharmacySelector';
import ChatBox from '../components/shared/ChatBox';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { format } from 'date-fns';

// Full order status flow for patient-side display
const ORDER_STEPS_DELIVERY = [
  { status: 'accepted',   label: 'Accepted',      icon: CheckCircle },
  { status: 'confirmed',  label: 'Confirmed',      icon: Package },
  { status: 'preparing',  label: 'Preparing',      icon: Package },
  { status: 'dispatched', label: 'On the Way',     icon: Truck },
  { status: 'delivered',  label: 'Delivered',      icon: CheckCircle },
  { status: 'completed',  label: 'Completed',      icon: CheckCircle },
];

const ORDER_STEPS_PICKUP = [
  { status: 'accepted',      label: 'Accepted',         icon: CheckCircle },
  { status: 'confirmed',     label: 'Confirmed',         icon: Package },
  { status: 'preparing',     label: 'Preparing',         icon: Package },
  { status: 'pickup_ready',  label: 'Ready for Pickup',  icon: ShoppingCart },
  { status: 'completed',     label: 'Completed',         icon: CheckCircle },
];

const STATUS_ORDER = [
  'accepted','confirmed','preparing','dispatched','delivered','pickup_ready','picked_up','completed'
];

function getStepIndex(status: string) {
  return STATUS_ORDER.indexOf(status);
}

export default function PrescriptionDetail() {
  const { id }    = useParams<{ id: string }>();
  const { user }  = useAuth();
  const socket    = useSocket();
  const navigate  = useNavigate();

  const [prescription, setPrescription]       = useState<any>(null);
  const [quotations, setQuotations]           = useState<any[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [requesting, setRequesting]           = useState(false);
  const [accepting, setAccepting]             = useState<string | null>(null);
  const [completing, setCompleting]           = useState<string | null>(null);
  const [tab, setTab]                         = useState<'info' | 'quotes' | 'chat'>('info');
  const [selectedPharmacies, setSelectedPharmacies] = useState<string[]>([]);
  const [activeChat, setActiveChat]           = useState<{ id: string; name: string } | null>(null);
  const [isProcessing, setIsProcessing]       = useState(false);

  const loadData = useCallback(async () => {
    try {
      const { data } = await prescriptionAPI.getById(id!);
      setPrescription(data.prescription);
      setIsProcessing(data.prescription.status === 'processing');

      const showQuoteStatuses = ['quotes_received','accepted','confirmed','preparing',
                                  'dispatched','delivered','pickup_ready','picked_up','completed'];
      if (showQuoteStatuses.includes(data.prescription.status)) {
        const qRes = await quotationAPI.getForPrescription(id!);
        setQuotations(qRes.data.quotations);
      }
    } catch {
      toast.error('Prescription not found');
      navigate(-1);
    } finally { setLoading(false); }
  }, [id, navigate]);

  useEffect(() => { loadData(); }, [loadData]);

  // Real-time OCR completion
  useEffect(() => {
    if (!socket || !isProcessing) return;
    const onProcessed = (data: any) => {
      if (String(data.prescriptionId) === id) {
        setIsProcessing(false);
        loadData();
        toast.success('✅ Prescription processed!');
      }
    };
    const onFailed = (data: any) => {
      if (String(data.prescriptionId) === id) {
        setIsProcessing(false);
        loadData();
        toast.error('OCR failed. Please try again.');
      }
    };
    socket.on('prescription_processed', onProcessed);
    socket.on('prescription_failed', onFailed);
    return () => { socket.off('prescription_processed', onProcessed); socket.off('prescription_failed', onFailed); };
  }, [socket, isProcessing, id, loadData]);

  // Real-time order updates
  useEffect(() => {
    if (!socket) return;
    const onStatusUpdate = (data: any) => {
      if (String(data.prescriptionId) === id) {
        loadData();
        toast.success(`Order update: ${data.label || data.status}`);
      }
    };
    socket.on('order_status_updated', onStatusUpdate);
    socket.on('order_completed',      onStatusUpdate);
    return () => { socket.off('order_status_updated', onStatusUpdate); socket.off('order_completed', onStatusUpdate); };
  }, [socket, id, loadData]);

  const requestQuotes = async () => {
    if (!selectedPharmacies.length) { toast.error('Select at least one pharmacy'); return; }
    setRequesting(true);
    try {
      await prescriptionAPI.requestQuotes(id!, selectedPharmacies);
      toast.success(`✅ Sent to ${selectedPharmacies.length} pharmacy(s)!`);
      await loadData();
      setTab('quotes');
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setRequesting(false); }
  };

  const acceptQuote = async (qId: string) => {
    setAccepting(qId);
    try {
      await quotationAPI.accept(qId);
      toast.success('Quotation accepted!');
      await loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Failed'); }
    finally { setAccepting(null); }
  };

  // Patient confirms they received medicines → marks completed
  const completeOrder = async (qId: string) => {
    setCompleting(qId);
    try {
      await quotationAPI.complete(qId);
      toast.success('🎉 Order marked as completed!');
      await loadData();
    } catch (err: any) { toast.error(err.response?.data?.error || 'Cannot complete yet'); }
    finally { setCompleting(null); }
  };

  if (loading) return <div className="flex justify-center py-20"><LoadingSpinner size="lg" /></div>;
  if (!prescription) return null;

  const isPatient         = user?.role === 'patient';
  const canEdit           = isPatient && prescription.status === 'extracted';
  const selectedQuotation = quotations.find(q => q.orderStatus === 'accepted' ||
    ['confirmed','preparing','dispatched','delivered','pickup_ready','picked_up','completed'].includes(q.orderStatus));

  const fulfillmentType = selectedQuotation?.fulfillmentType || prescription.fulfillmentType || 'delivery';
  const orderSteps      = fulfillmentType === 'pickup' ? ORDER_STEPS_PICKUP : ORDER_STEPS_DELIVERY;
  const currentStepIdx  = getStepIndex(prescription.status);
  const isActiveOrder   = currentStepIdx >= 0;

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-4">
        <ChevronLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex items-start justify-between mb-4 flex-wrap gap-2">
        <div>
          <h1 className="text-xl font-display font-bold">Prescription Details</h1>
          <p className="text-sm text-gray-400">{format(new Date(prescription.createdAt), 'MMM d, yyyy · h:mm a')}</p>
        </div>
        <div className="flex items-center gap-2">
          {prescription.isUrgent && <span className="badge bg-red-100 text-red-700">🚨 Urgent</span>}
          <StatusBadge status={prescription.status} />
        </div>
      </div>

      {/* Processing spinner */}
      {isProcessing && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-3">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin flex-shrink-0" />
          <div>
            <p className="font-medium text-blue-800 text-sm">AI is processing your prescription…</p>
            <p className="text-xs text-blue-500 mt-0.5">OCR + VLM extraction running. Up to 30 seconds.</p>
          </div>
        </div>
      )}

      {/* ── Order progress tracker ── */}
      {isActiveOrder && (
        <div className="card mb-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Order Progress · {fulfillmentType === 'pickup' ? '🏪 Pickup' : '🚚 Delivery'}
          </p>
          <div className="flex items-center justify-between gap-1 overflow-x-auto pb-1">
            {orderSteps.map((step, idx) => {
              const stepStatus  = getStepIndex(step.status);
              const isDone      = stepStatus <= currentStepIdx && currentStepIdx >= 0;
              const isCurrent   = step.status === prescription.status;
              return (
                <React.Fragment key={step.status}>
                  <div className="flex flex-col items-center gap-1 flex-shrink-0 min-w-[60px]">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                      ${isCurrent  ? 'border-primary-600 bg-primary-600 text-white scale-110' :
                        isDone     ? 'border-primary-400 bg-primary-100 text-primary-600' :
                                     'border-gray-200 bg-white text-gray-300'}`}>
                      <step.icon className="w-4 h-4" />
                    </div>
                    <span className={`text-[10px] text-center leading-tight ${isCurrent ? 'text-primary-700 font-semibold' : isDone ? 'text-gray-600' : 'text-gray-300'}`}>
                      {step.label}
                    </span>
                  </div>
                  {idx < orderSteps.length - 1 && (
                    <div className={`flex-1 h-0.5 min-w-[12px] rounded transition-all ${isDone && getStepIndex(orderSteps[idx+1].status) <= currentStepIdx ? 'bg-primary-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-5 gap-1">
        {[
          { key: 'info',   label: 'Details',           icon: Image },
          { key: 'quotes', label: `Quotes (${quotations.length})`, icon: ShoppingBag },
          { key: 'chat',   label: 'Chat',               icon: MessageSquare },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-all
              ${tab === t.key ? 'bg-white text-primary-700 shadow-sm' : 'text-gray-500'}`}>
            <t.icon className="w-4 h-4" />{t.label}
          </button>
        ))}
      </div>

      {/* ── TAB: Info ── */}
      {tab === 'info' && (
        <div className="space-y-4">
          <div className="card">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-2">📄 Prescription Image</p>
                {prescription.imageUrl
                  ? <a href={prescription.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={prescription.imageUrl} alt="Rx" className="rounded-xl border max-h-64 w-full object-contain hover:opacity-90 transition-opacity" />
                    </a>
                  : <div className="h-32 bg-gray-50 rounded-xl flex items-center justify-center text-gray-300">No image</div>
                }
              </div>
              <div className="space-y-2 text-sm">
                {prescription.notes && (
                  <div className="p-3 bg-yellow-50 border border-yellow-100 rounded-lg">
                    <p className="text-xs text-yellow-600 font-semibold mb-1">Notes</p>
                    <p className="text-yellow-800">{prescription.notes}</p>
                  </div>
                )}
                {prescription.sentToPharmacies?.length > 0 && (
                  <div>
                    <p className="text-xs text-gray-400 mb-1">Sent to</p>
                    <div className="flex flex-wrap gap-1">
                      {prescription.sentToPharmacies.map((p: any) => (
                        <span key={p._id} className="badge bg-gray-100 text-gray-600 text-xs">{p.name}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {prescription.status !== 'processing' && (
            prescription.status === 'failed'
              ? <div className="card text-center py-8">
                  <AlertTriangle className="w-10 h-10 text-red-300 mx-auto mb-2" />
                  <p className="font-medium text-gray-800">OCR Failed</p>
                  <p className="text-sm text-gray-500 mt-1">{prescription.ocrProcessingError || 'Could not extract text. Please upload a clearer image.'}</p>
                </div>
              : <ExtractionResult
                  medicines={prescription.extractedMedicines || []}
                  patientInfo={prescription.patientInfoExtracted}
                  doctorInfo={{ name: prescription.doctorName, reg_no: prescription.doctorRegNo, hospital: prescription.hospitalName }}
                  prescriptionDate={prescription.prescriptionDate}
                  writingStyle={prescription.writingStyle}
                  ocrConfidence={prescription.ocrConfidence}
                  overallConfidence={prescription.ocrConfidence}
                  ocrRawText={prescription.ocrRawText}
                  prescriptionId={id!}
                  canEdit={canEdit}
                  onMedicinesUpdated={meds => setPrescription((p: any) => ({ ...p, extractedMedicines: meds }))}
                />
          )}

          {prescription.status === 'extracted' && isPatient && (
            <div className="card">
              <h3 className="font-semibold text-gray-800 mb-1 flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4 text-primary-500" /> Select Pharmacies
              </h3>
              <p className="text-xs text-gray-400 mb-3">Choose pharmacies to receive your prescription.</p>
              <PharmacySelector onSelectionChange={setSelectedPharmacies} />
              <button onClick={requestQuotes} disabled={requesting || !selectedPharmacies.length}
                className="btn-primary w-full py-3 mt-4 font-semibold flex items-center justify-center gap-2">
                {requesting
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Sending…</>
                  : <><Send className="w-4 h-4" />Request Quotes from {selectedPharmacies.length} Pharmacy(s)</>
                }
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── TAB: Quotes ── */}
      {tab === 'quotes' && (
        <div className="space-y-4">
          {prescription.status === 'quote_requested' && (
            <div className="p-4 bg-yellow-50 border border-yellow-100 rounded-xl flex items-center gap-3">
              <Loader2 className="w-4 h-4 text-yellow-500 animate-spin flex-shrink-0" />
              <p className="text-sm text-yellow-700">Waiting for pharmacies to submit quotes…</p>
            </div>
          )}

          {quotations.length === 0 && prescription.status !== 'quote_requested' && (
            <div className="card text-center py-10">
              <ShoppingBag className="w-10 h-10 text-gray-200 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No quotes yet</p>
            </div>
          )}

          {quotations.map(q => {
            const isSelected  = ['accepted','confirmed','preparing','dispatched','delivered',
                                  'pickup_ready','picked_up','completed'].includes(q.orderStatus);
            const isCompleted = q.orderStatus === 'completed';
            const canComplete = isPatient && ['delivered','pickup_ready','picked_up'].includes(q.orderStatus);

            return (
              <div key={q._id} className={`card border-2 transition-all ${isSelected ? 'border-primary-300 shadow-md' : 'border-gray-100'}`}>
                {isSelected && !isCompleted && (
                  <div className="flex items-center gap-1.5 text-primary-600 text-xs font-semibold mb-3">
                    <CheckCircle className="w-3.5 h-3.5" /> Selected Quotation
                  </div>
                )}
                {isCompleted && (
                  <div className="flex items-center gap-1.5 text-green-600 text-xs font-semibold mb-3">
                    <CheckCircle className="w-3.5 h-3.5" /> Order Completed 🎉
                  </div>
                )}

                {/* Header */}
                <div className="flex items-start justify-between mb-3 flex-wrap gap-2">
                  <div>
                    <h3 className="font-semibold text-gray-900">{q.pharmacy?.name}</h3>
                    <p className="text-xs text-gray-400">
                      {q.pharmacy?.pharmacyProfile?.district}
                      {q.pharmacy?.pharmacyProfile?.gramaNiladhari?.divisionName &&
                        ` · ${q.pharmacy.pharmacyProfile.gramaNiladhari.divisionName}`}
                    </p>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      <StatusBadge status={q.orderStatus} />
                      {q.fulfillmentType === 'pickup'
                        ? <span className="badge bg-cyan-100 text-cyan-700">🏪 Pickup</span>
                        : <span className="badge bg-blue-100 text-blue-700">🚚 Delivery</span>
                      }
                      {q.isDeliveryAvailable && q.fulfillmentType !== 'pickup' && (
                        <span className="badge bg-green-100 text-green-700">✔ Delivery available</span>
                      )}
                      {q.estimatedTime && (
                        <span className="badge bg-gray-100 text-gray-600">⏱ {q.estimatedTime}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-2xl font-bold text-primary-600">LKR {q.totalAmount?.toFixed(2)}</p>
                    {q.deliveryFee > 0 && <p className="text-xs text-gray-400">incl. LKR {q.deliveryFee} delivery</p>}
                  </div>
                </div>

                {/* Items */}
                <div className="bg-gray-50 rounded-xl overflow-hidden mb-3">
                  <table className="w-full text-xs">
                    <thead><tr className="border-b border-gray-100">
                      <th className="text-left p-2 text-gray-400 font-medium">Medicine</th>
                      <th className="text-center p-2 text-gray-400 font-medium">Qty</th>
                      <th className="text-right p-2 text-gray-400 font-medium">Price</th>
                    </tr></thead>
                    <tbody>
                      {q.items?.map((item: any, idx: number) => (
                        <tr key={idx} className="border-b border-gray-50 last:border-0">
                          <td className={`p-2 ${!item.available ? 'line-through text-gray-300' : ''}`}>
                            {item.medicineName}
                            {item.substitute && <span className="text-blue-500 ml-1 not-italic">→ {item.substitute}</span>}
                          </td>
                          <td className="p-2 text-center text-gray-600">{item.quantity || 1}</td>
                          <td className="p-2 text-right text-gray-700">
                            {item.available ? `LKR ${item.totalPrice?.toFixed(2)}` : <span className="text-red-400">N/A</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {q.notes && <p className="text-xs text-gray-400 italic mb-3">"{q.notes}"</p>}

                {/* Action buttons */}
                <div className="flex gap-2 flex-wrap">
                  {/* Chat button */}
                  <button
                    onClick={() => { setActiveChat({ id: q.pharmacy._id, name: q.pharmacy.name }); setTab('chat'); }}
                    className="btn-secondary flex items-center gap-1.5 text-sm flex-1"
                  >
                    <MessageSquare className="w-4 h-4" /> Chat
                  </button>

                  {/* Accept */}
                  {isPatient && q.orderStatus === 'submitted' && prescription.status !== 'accepted' && (
                    <button onClick={() => acceptQuote(q._id)} disabled={accepting === q._id}
                      className="btn-primary flex-1 text-sm">
                      {accepting === q._id ? <Loader2 className="w-4 h-4 animate-spin inline" /> : '✅ Accept Quote'}
                    </button>
                  )}

                  {/* Patient marks completed (after delivered or pickup_ready) */}
                  {canComplete && (
                    <button onClick={() => completeOrder(q._id)} disabled={completing === q._id}
                      className="flex-1 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-1.5 transition-colors">
                      {completing === q._id
                        ? <Loader2 className="w-4 h-4 animate-spin" />
                        : <><CheckCircle className="w-4 h-4" />
                            {q.orderStatus === 'pickup_ready' ? 'I Collected My Medicines' : 'I Received My Medicines'}
                          </>
                      }
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── TAB: Chat ── */}
      {tab === 'chat' && (
        <div className="space-y-3">
          {activeChat ? (
            <>
              <button onClick={() => setActiveChat(null)} className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                <ChevronLeft className="w-3 h-3" /> All chats
              </button>
              <ChatBox prescriptionId={id!} pharmacyId={activeChat.id} pharmacyName={activeChat.name} />
            </>
          ) : (
            quotations.length > 0
              ? <div className="space-y-2">
                  <p className="text-xs text-gray-400 font-medium">Select a pharmacy to chat with:</p>
                  {quotations.map(q => (
                    <button key={q._id} onClick={() => setActiveChat({ id: q.pharmacy._id, name: q.pharmacy.name })}
                      className="w-full text-left p-3.5 bg-white border border-gray-200 hover:border-primary-300 rounded-xl flex items-center justify-between transition-all">
                      <div>
                        <p className="font-medium text-sm text-gray-800">{q.pharmacy.name}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <StatusBadge status={q.orderStatus} />
                          <span className="text-xs text-gray-400">LKR {q.totalAmount?.toFixed(2)}</span>
                        </div>
                      </div>
                      <MessageSquare className="w-5 h-5 text-primary-400" />
                    </button>
                  ))}
                </div>
              : <ChatBox prescriptionId={id!} />
          )}
        </div>
      )}
    </div>
  );
}
