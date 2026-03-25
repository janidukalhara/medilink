import React, { useState, useEffect } from 'react';
import { MapPin, Plus, Minus, Truck, Clock, CheckCircle, Loader2, RefreshCw } from 'lucide-react';
import { pharmacyAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface Pharmacy {
  _id: string;
  name: string;
  email: string;
  phone: string;
  pharmacyProfile?: {
    address?: string;
    district?: string;
    province?: string;
    gramaNiladhari?: { divisionName?: string };
    isDeliveryAvailable?: boolean;
    openHours?: string;
    deliveryRadiusKm?: number;
  };
}

interface Props {
  onSelectionChange: (ids: string[]) => void;
  initialSelected?: string[];
}

export default function PharmacySelector({ onSelectionChange, initialSelected = [] }: Props) {
  const [pharmacies, setPharmacies] = useState<Pharmacy[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialSelected));
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [locationMode, setLocationMode] = useState<'all' | 'nearby'>('all');
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);

  const loadPharmacies = async (lat?: number, lng?: number) => {
    setLoading(true);
    try {
      const params: any = { limit: 30 };
      if (lat && lng) { params.lat = lat; params.lng = lng; params.radiusKm = 25; }

      const { data } = await pharmacyAPI.getNearby(params);
      setPharmacies(data.pharmacies);

      // Auto-select all by default
      const ids = new Set(data.pharmacies.map((p: Pharmacy) => p._id));
      setSelected(ids);
      onSelectionChange([...ids]);
    } catch { toast.error('Could not load pharmacies'); }
    finally { setLoading(false); }
  };

  const locateUser = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        setUserCoords({ lat: latitude, lng: longitude });
        setLocationMode('nearby');
        loadPharmacies(latitude, longitude);
        setLocating(false);
      },
      () => {
        toast.error('Could not get location. Showing all pharmacies.');
        setLocating(false);
      },
      { timeout: 10000 }
    );
  };

  useEffect(() => { loadPharmacies(); }, []);

  const togglePharmacy = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
    onSelectionChange([...next]);
  };

  const selectAll = () => {
    const all = new Set(pharmacies.map(p => p._id));
    setSelected(all);
    onSelectionChange([...all]);
  };

  const clearAll = () => { setSelected(new Set()); onSelectionChange([]); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-primary-600 mr-2" />
        <span className="text-sm text-gray-500">Loading pharmacies...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-700">
            {selected.size} / {pharmacies.length} selected
          </span>
        </div>
        <div className="flex gap-2">
          <button
            onClick={locating ? undefined : locateUser}
            disabled={locating}
            className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border transition-colors ${locationMode === 'nearby' ? 'bg-primary-600 text-white border-primary-600' : 'bg-white text-gray-600 border-gray-200 hover:border-primary-400'}`}
          >
            {locating ? <Loader2 className="w-3 h-3 animate-spin" /> : <MapPin className="w-3 h-3" />}
            {locationMode === 'nearby' ? 'Nearby ✓' : 'Find Nearby'}
          </button>
          {locationMode === 'nearby' && (
            <button onClick={() => { setLocationMode('all'); loadPharmacies(); }}
              className="flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg border bg-white text-gray-600 hover:border-gray-400">
              <RefreshCw className="w-3 h-3" /> Show All
            </button>
          )}
          <button onClick={selectAll} className="text-xs px-2 py-1.5 rounded-lg bg-green-50 text-green-700 hover:bg-green-100">
            <CheckCircle className="w-3 h-3 inline mr-1" />All
          </button>
          <button onClick={clearAll} className="text-xs px-2 py-1.5 rounded-lg bg-red-50 text-red-600 hover:bg-red-100">
            <Minus className="w-3 h-3 inline mr-1" />None
          </button>
        </div>
      </div>

      {pharmacies.length === 0 && (
        <div className="text-center py-6 text-gray-500 text-sm">No pharmacies found</div>
      )}

      {/* Pharmacy list */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {pharmacies.map(p => {
          const isSelected = selected.has(p._id);
          return (
            <button
              key={p._id}
              onClick={() => togglePharmacy(p._id)}
              className={`w-full text-left p-3 rounded-xl border-2 transition-all ${
                isSelected
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className={`w-4 h-4 rounded flex items-center justify-center flex-shrink-0 border-2 ${isSelected ? 'bg-primary-600 border-primary-600' : 'border-gray-300'}`}>
                      {isSelected && <CheckCircle className="w-3 h-3 text-white" />}
                    </div>
                    <span className="font-medium text-sm text-gray-900 truncate">{p.name}</span>
                  </div>
                  <div className="ml-6 mt-1 flex flex-wrap gap-1.5 text-xs text-gray-500">
                    {p.pharmacyProfile?.district && (
                      <span className="flex items-center gap-0.5">
                        <MapPin className="w-3 h-3" />
                        {p.pharmacyProfile.district}
                        {p.pharmacyProfile.gramaNiladhari?.divisionName && ` · ${p.pharmacyProfile.gramaNiladhari.divisionName}`}
                      </span>
                    )}
                    {p.pharmacyProfile?.openHours && (
                      <span className="flex items-center gap-0.5">
                        <Clock className="w-3 h-3" />{p.pharmacyProfile.openHours}
                      </span>
                    )}
                  </div>
                </div>
                {p.pharmacyProfile?.isDeliveryAvailable && (
                  <span className="badge bg-green-100 text-green-700 flex-shrink-0">
                    <Truck className="w-3 h-3 mr-1" />Delivery
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {selected.size === 0 && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span>⚠️</span> Please select at least one pharmacy
        </p>
      )}
    </div>
  );
}
