import React, { useState, useEffect } from 'react';
import { MapPin, Truck, Clock, CheckCircle, Loader2, RefreshCw, ShieldCheck, Info } from 'lucide-react';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface Pharmacy {
  _id: string;
  name: string;
  email: string;
  phone: string;
  _matchTier?: string;
  _distanceKm?: number | null;
  _gnMatch?: boolean;
  pharmacyProfile?: {
    address?: string;
    district?: string;
    gramaNiladhari?: { divisionName?: string };
    isDeliveryAvailable?: boolean;
    openHours?: string;
  };
}

interface MatchSummary {
  gnMatch: number;
  within3km: number;
  within5km: number;
  district: number;
}

interface Props {
  prescriptionId: string;
  onSelectionChange: (ids: string[]) => void;
  initialSelected?: string[];
}

const TIER_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  gn_match:  { label: 'Same GN Division', color: 'bg-purple-100 text-purple-700', icon: '📍' },
  '3km':     { label: 'Within 3 km',       color: 'bg-green-100 text-green-700',   icon: '🏃' },
  '5km':     { label: 'Within 5 km',       color: 'bg-blue-100 text-blue-700',     icon: '🚗' },
  district:  { label: 'Same District',     color: 'bg-yellow-100 text-yellow-700', icon: '🗺️' },
  all:       { label: 'All Pharmacies',    color: 'bg-gray-100 text-gray-600',     icon: '🏥' },
};

export default function PharmacySelector({ prescriptionId, onSelectionChange, initialSelected = [] }: Props) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [matchSummary, setMatchSummary] = useState<MatchSummary | null>(null);
  const [patientGN, setPatientGN] = useState<string | null>(null);

  const loadPharmacies = async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      const params: any = { limit: 30 };
      if (lat && lng) {
        params.lat = lat;
        params.lng = lng;
        params.prescriptionId = prescriptionId;
      }
      const { data } = await pharmacyAPI.getNearby(params);
      setPharmacies(data.pharmacies);
      if (data.summary) setMatchSummary(data.summary);
      if (data.patientGN) setPatientGN(data.patientGN);

      // Auto-select GN-matched + within 3km pharmacies; fallback: select all
      const priorityIds = data.pharmacies
        .filter((p: Pharmacy) => p._matchTier === 'gn_match' || p._matchTier === '3km')
        .map((p: Pharmacy) => p._id);

      const autoSelect = priorityIds.length > 0
        ? new Set<string>(priorityIds)
        : new Set<string>(data.pharmacies.map((p: Pharmacy) => p._id));

      setSelected(autoSelect);
      onSelectionChange([...autoSelect]);
    } catch {
      toast.error('Could not load pharmacies');
    } finally {
      setLoading(false);
    }
  };

  const locateAndLoad = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        loadPharmacies(latitude, longitude);
        setLocating(false);
      },
      () => {
        toast.error('Could not get location. Showing all pharmacies.');
        setLocating(false);
        loadPharmacies();
      },
      { timeout: 10000 }
    );
  };

  useEffect(() => {
    // Try GPS automatically on mount
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
          loadPharmacies(pos.coords.latitude, pos.coords.longitude);
        },
        () => loadPharmacies()
      );
    } else {
      loadPharmacies();
    }
  }, []);

  const togglePharmacy = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
    onSelectionChange([...next]);
  };

  const selectAll = () => {
    const all = new Set(pharmacies.map(p => p._id));
    setSelected(all); onSelectionChange([...all]);
  };

  const clearAll = () => { setSelected(new Set()); onSelectionChange([]); };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-2">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600" />
        <span className="text-sm text-gray-500">Finding best pharmacies for you...</span>
      </div>
    );
  }

  // Group by tier for display
  const byTier: Record<string, Pharmacy[]> = {};
  pharmacies.forEach(p => {
    const tier = p._matchTier || 'all';
    if (!byTier[tier]) byTier[tier] = [];
    byTier[tier].push(p);
  });

  const tierOrder = ['gn_match', '3km', '5km', 'district', 'all'];

  return (
    <div className="space-y-3">
      {/* Smart match info banner */}
      {matchSummary && (
        <div className="p-3 bg-blue-50 border border-blue-100 rounded-xl text-xs text-blue-800 space-y-1">
          <div className="flex items-center gap-1.5 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5" />
            Smart pharmacy matching active
            {patientGN && <span className="font-normal text-blue-600">· Your GN: {patientGN}</span>}
          </div>
          <div className="flex flex-wrap gap-2">
            {matchSummary.gnMatch > 0 && <span className="px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700">📍 {matchSummary.gnMatch} same GN division</span>}
            {matchSummary.within3km > 0 && <span className="px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">🏃 {matchSummary.within3km} within 3 km</span>}
            {matchSummary.within5km > 0 && <span className="px-1.5 py-0.5 rounded-full bg-blue-100 text-blue-700">🚗 {matchSummary.within5km} within 5 km</span>}
            {matchSummary.district > 0 && <span className="px-1.5 py-0.5 rounded-full bg-yellow-100 text-yellow-700">🗺️ {matchSummary.district} same district</span>}
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <span className="text-sm font-medium text-gray-700">{selected.size} / {pharmacies.length} selected</span>
        <div className="flex gap-2">
          <button onClick={locating ? undefined : locateAndLoad} disabled={locating}
            className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-primary-400 transition-colors">
            {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
            Refresh location
          </button>
          <button onClick={selectAll} className="text-xs px-2.5 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">All</button>
          <button onClick={clearAll} className="text-xs px-2.5 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100">None</button>
        </div>
      </div>

      {/* Pharmacy list grouped by tier */}
      <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
        {tierOrder.map(tier => {
          const group = byTier[tier];
          if (!group?.length) return null;
          const tierInfo = TIER_LABELS[tier];

          return (
            <div key={tier}>
              <div className="flex items-center gap-2 mb-1.5">
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tierInfo.color}`}>
                  {tierInfo.icon} {tierInfo.label}
                </span>
                <div className="flex-1 h-px bg-gray-100" />
              </div>
              <div className="space-y-1.5">
                {group.map(p => {
                  const isSelected = selected.has(p._id);
                  return (
                    <button key={p._id} onClick={() => togglePharmacy(p._id)}
                      className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                        isSelected ? 'border-primary-500 bg-primary-50' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                              {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                            </div>
                            <span className="font-medium text-sm text-gray-900 truncate">{p.name}</span>
                          </div>
                          <div className="ml-6 mt-1 flex flex-wrap gap-2 text-xs text-gray-500">
                            {p.pharmacyProfile?.district && (
                              <span className="flex items-center gap-0.5">
                                <MapPin className="w-3 h-3" />{p.pharmacyProfile.district}
                                {p.pharmacyProfile?.gramaNiladhari?.divisionName && ` · ${p.pharmacyProfile.gramaNiladhari.divisionName}`}
                              </span>
                            )}
                            {p._distanceKm != null && (
                              <span className="text-blue-500">{p._distanceKm.toFixed(1)} km</span>
                            )}
                            {p.pharmacyProfile?.openHours && (
                              <span className="flex items-center gap-0.5">
                                <Clock className="w-3 h-3" />{p.pharmacyProfile.openHours}
                              </span>
                            )}
                          </div>
                        </div>
                        {p.pharmacyProfile?.isDeliveryAvailable && (
                          <span className="text-xs px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 flex-shrink-0 flex items-center gap-0.5">
                            <Truck className="w-3 h-3" /> Delivery
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {selected.size === 0 && (
        <p className="text-xs text-red-500 flex items-center gap-1">⚠️ Please select at least one pharmacy</p>
      )}
    </div>
  );
}
