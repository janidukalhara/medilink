/**
 * QuotationComparison — side-by-side comparison of received pharmacy quotes
 * Shows best price, availability, delivery, estimated time, and an AI-style score.
 */
import React, { useMemo, useState } from 'react';
import {
  Trophy, Truck, Clock, Package, CheckCircle, XCircle,
  TrendingDown, Star, ChevronDown, ChevronUp, ShieldCheck
} from 'lucide-react';
import { quotationAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface QuotationItem {
  medicineName: string;
  available: boolean;
  unitPrice?: number;
  quantity?: number;
  totalPrice?: number;
  notes?: string;
  substitute?: string;
}

interface Quotation {
  _id: string;
  pharmacy: { _id: string; name: string; pharmacyProfile?: any };
  items: QuotationItem[];
  subtotal: number;
  deliveryFee: number;
  totalAmount: number;
  isDeliveryAvailable: boolean;
  estimatedTime?: string;
  fulfillmentType?: string;
  notes?: string;
  orderStatus: string;
  validUntil?: string;
  _distanceKm?: number;
  _gnMatch?: boolean;
}

interface Props {
  quotations: Quotation[];
  onAccept: (quotationId: string) => Promise<void>;
}

// ── Scoring logic ──────────────────────────────────────────────────────────────
function scoreQuotation(q: Quotation, allQuotations: Quotation[]) {
  const prices = allQuotations.map(x => x.totalAmount).filter(Boolean);
  const maxPrice = Math.max(...prices);
  const minPrice = Math.min(...prices);
  const priceRange = maxPrice - minPrice || 1;

  // 1. Price score (40 pts) — lower is better
  const priceScore = ((maxPrice - q.totalAmount) / priceRange) * 40;

  // 2. Availability score (30 pts) — how many medicines are available
  const total = q.items.length || 1;
  const available = q.items.filter(i => i.available).length;
  const availScore = (available / total) * 30;

  // 3. Delivery score (15 pts)
  const deliveryScore = q.isDeliveryAvailable ? 15 : 5;

  // 4. GN proximity score (10 pts)
  const gnScore = q._gnMatch ? 10 : (q._distanceKm != null && q._distanceKm <= 3 ? 7 : 3);

  // 5. Speed score (5 pts) — parse estimatedTime
  let speedScore = 3;
  if (q.estimatedTime) {
    const hours = parseFloat(q.estimatedTime);
    if (!isNaN(hours)) speedScore = hours <= 2 ? 5 : hours <= 4 ? 3 : 1;
  }

  const total_score = Math.round(priceScore + availScore + deliveryScore + gnScore + speedScore);
  return Math.min(100, total_score);
}

function getBadge(score: number) {
  if (score >= 80) return { label: 'Best Value', color: 'bg-green-100 text-green-700', icon: Trophy };
  if (score >= 60) return { label: 'Good', color: 'bg-blue-100 text-blue-700', icon: ShieldCheck };
  return { label: 'Fair', color: 'bg-gray-100 text-gray-600', icon: Package };
}

export default function QuotationComparison({ quotations, onAccept }: Props) {
  const [accepting, setAccepting] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<string | null>(null);

  const submittedQuotes = quotations.filter(q => q.orderStatus === 'submitted');

  const scored = useMemo(() => {
    return submittedQuotes
      .map(q => ({ ...q, score: scoreQuotation(q, submittedQuotes) }))
      .sort((a, b) => b.score - a.score);
  }, [submittedQuotes]);

  const bestId = scored[0]?._id;
  const cheapestId = [...scored].sort((a, b) => a.totalAmount - b.totalAmount)[0]?._id;
  const mostAvailId = [...scored].sort((a, b) => {
    const aA = a.items.filter(i => i.available).length / (a.items.length || 1);
    const bA = b.items.filter(i => i.available).length / (b.items.length || 1);
    return bA - aA;
  })[0]?._id;

  const handleAccept = async (id: string) => {
    setAccepting(id);
    try {
      await onAccept(id);
    } catch {
      toast.error('Failed to accept quotation');
    } finally {
      setAccepting(null);
    }
  };

  if (scored.length === 0) {
    return (
      <div className="text-center py-10 text-gray-400">
        <Package className="w-10 h-10 mx-auto mb-2 opacity-40" />
        <p className="text-sm">No quotations to compare yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Quotes received', value: scored.length, color: 'text-blue-600' },
          { label: 'Lowest price', value: `LKR ${Math.min(...scored.map(q => q.totalAmount)).toLocaleString()}`, color: 'text-green-600' },
          { label: 'Best availability', value: `${Math.round(Math.max(...scored.map(q => q.items.filter(i => i.available).length / (q.items.length || 1))) * 100)}%`, color: 'text-purple-600' },
        ].map(({ label, value, color }) => (
          <div key={label} className="bg-gray-50 rounded-xl p-3 text-center">
            <p className={`text-lg font-bold ${color}`}>{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Quotation cards */}
      {scored.map((q, idx) => {
        const badge = getBadge(q.score);
        const BadgeIcon = badge.icon;
        const availCount = q.items.filter(i => i.available).length;
        const isExpanded = expanded === q._id;
        const isBest = q._id === bestId;

        return (
          <div key={q._id}
            className={`rounded-2xl border-2 transition-all ${isBest ? 'border-green-400 shadow-md' : 'border-gray-200'}`}>

            {/* Header */}
            <div className={`px-4 py-3 rounded-t-2xl flex items-center justify-between ${isBest ? 'bg-green-50' : 'bg-gray-50'}`}>
              <div className="flex items-center gap-2">
                <span className="text-lg font-bold text-gray-800">#{idx + 1}</span>
                <span className="font-semibold text-gray-900">{q.pharmacy?.name}</span>
                {isBest && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500 text-white font-medium">
                    <Trophy className="w-3 h-3" /> Best Overall
                  </span>
                )}
                {q._id === cheapestId && q._id !== bestId && (
                  <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">
                    <TrendingDown className="w-3 h-3" /> Lowest Price
                  </span>
                )}
              </div>
              {/* Score ring */}
              <div className="flex items-center gap-2">
                <div className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${badge.color}`}>
                  <BadgeIcon className="w-3 h-3" /> {badge.label}
                </div>
                <div className="relative w-10 h-10">
                  <svg viewBox="0 0 36 36" className="w-10 h-10 -rotate-90">
                    <circle cx="18" cy="18" r="15" fill="none" stroke="#e5e7eb" strokeWidth="3" />
                    <circle cx="18" cy="18" r="15" fill="none"
                      stroke={q.score >= 80 ? '#22c55e' : q.score >= 60 ? '#3b82f6' : '#9ca3af'}
                      strokeWidth="3"
                      strokeDasharray={`${(q.score / 100) * 94.2} 94.2`}
                      strokeLinecap="round" />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-gray-700">
                    {q.score}
                  </span>
                </div>
              </div>
            </div>

            {/* Key metrics */}
            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <p className="text-xs text-gray-500">Total Price</p>
                <p className="text-lg font-bold text-gray-900">LKR {q.totalAmount.toLocaleString()}</p>
                {q.deliveryFee > 0 && (
                  <p className="text-xs text-gray-400">incl. LKR {q.deliveryFee} delivery</p>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Availability</p>
                <div className="flex items-center gap-1 mt-0.5">
                  <div className="flex-1 bg-gray-200 rounded-full h-2">
                    <div className="bg-green-500 h-2 rounded-full transition-all"
                      style={{ width: `${(availCount / (q.items.length || 1)) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-gray-700">{availCount}/{q.items.length}</span>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Delivery</p>
                <div className="flex items-center gap-1 mt-1">
                  {q.isDeliveryAvailable
                    ? <><Truck className="w-4 h-4 text-green-500" /><span className="text-sm font-medium text-green-700">Available</span></>
                    : <><Package className="w-4 h-4 text-gray-400" /><span className="text-sm text-gray-500">Pickup only</span></>
                  }
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500">Est. Time</p>
                <div className="flex items-center gap-1 mt-1">
                  <Clock className="w-4 h-4 text-blue-400" />
                  <span className="text-sm font-medium text-gray-700">{q.estimatedTime || 'N/A'}</span>
                </div>
              </div>
            </div>

            {/* GN / distance badge */}
            {(q._gnMatch || q._distanceKm != null) && (
              <div className="px-4 pb-2 flex gap-2">
                {q._gnMatch && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 flex items-center gap-1">
                    📍 Same GN Division
                  </span>
                )}
                {q._distanceKm != null && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-600">
                    {q._distanceKm.toFixed(1)} km away
                  </span>
                )}
              </div>
            )}

            {/* Medicine breakdown toggle */}
            <div className="px-4 pb-3">
              <button
                onClick={() => setExpanded(isExpanded ? null : q._id)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 font-medium">
                {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                {isExpanded ? 'Hide' : 'Show'} medicine breakdown
              </button>

              {isExpanded && (
                <div className="mt-3 rounded-xl overflow-hidden border border-gray-100">
                  <table className="w-full text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-gray-600">Medicine</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-600">Qty</th>
                        <th className="text-right px-3 py-2 font-medium text-gray-600">Price</th>
                        <th className="text-center px-2 py-2 font-medium text-gray-600">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {q.items.map((item, i) => (
                        <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'}>
                          <td className="px-3 py-2">
                            <p className="font-medium text-gray-800">{item.medicineName}</p>
                            {item.substitute && (
                              <p className="text-gray-400 text-[10px]">Substitute: {item.substitute}</p>
                            )}
                          </td>
                          <td className="text-center px-2 py-2 text-gray-600">{item.quantity || 1}</td>
                          <td className="text-right px-3 py-2 font-medium text-gray-800">
                            {item.totalPrice ? `LKR ${item.totalPrice.toLocaleString()}` : '—'}
                          </td>
                          <td className="text-center px-2 py-2">
                            {item.available
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 mx-auto" />
                              : <XCircle className="w-3.5 h-3.5 text-red-400 mx-auto" />}
                          </td>
                        </tr>
                      ))}
                      <tr className="bg-blue-50 font-semibold">
                        <td colSpan={2} className="px-3 py-2 text-gray-700">Total</td>
                        <td className="text-right px-3 py-2 text-blue-700">LKR {q.totalAmount.toLocaleString()}</td>
                        <td />
                      </tr>
                    </tbody>
                  </table>
                  {q.notes && (
                    <div className="px-3 py-2 bg-yellow-50 text-xs text-yellow-800 border-t border-yellow-100">
                      📝 {q.notes}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Accept button */}
            <div className="px-4 pb-4">
              <div className="space-y-2">
                {/* Show fulfillment type info only */}
                {q.fulfillmentType === 'pickup' ? (
                  <div className="w-full py-2 rounded-xl text-xs text-center text-teal-700 bg-teal-50 border border-teal-200 font-medium">
                    🏪 Pickup — no delivery fee
                  </div>
                ) : q.isDeliveryAvailable ? (
                  <div className="w-full py-2 rounded-xl text-xs text-center text-blue-700 bg-blue-50 border border-blue-200 font-medium">
                    🚚 Delivery available · You can switch to pickup after accepting
                  </div>
                ) : null}
                <button
                  onClick={() => handleAccept(q._id)}
                  disabled={!!accepting}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                    isBest
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-primary-600 hover:bg-primary-700 text-white'
                  } disabled:opacity-50`}
                >
                  {accepting === q._id ? 'Accepting...' : `Accept ${isBest ? '(Recommended)' : 'Quotation'}`}
                </button>
              </div>
            </div>
          </div>
        );
      })}

      {/* Already accepted/rejected quotes */}
      {quotations.filter(q => !['submitted'].includes(q.orderStatus)).length > 0 && (
        <div className="border-t pt-4">
          <p className="text-xs font-medium text-gray-400 mb-2 uppercase tracking-wide">Other quotes</p>
          {quotations.filter(q => !['submitted'].includes(q.orderStatus)).map(q => (
            <div key={q._id} className="flex items-center justify-between py-2 text-sm border-b border-gray-100 last:border-0">
              <span className="text-gray-600">{q.pharmacy?.name}</span>
              <div className="flex items-center gap-2">
                <span className="text-gray-500">LKR {q.totalAmount?.toLocaleString()}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                  q.orderStatus === 'accepted' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'
                }`}>{q.orderStatus}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
