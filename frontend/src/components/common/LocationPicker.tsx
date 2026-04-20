/**
 * LocationPicker — Uber-style address autocomplete + drag-pin map
 * Uses OpenStreetMap (Leaflet) + Nominatim geocoder — zero API key required.
 * Biased to Sri Lanka bounding box for better local results.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { MapPin, Search, Loader2, X } from 'lucide-react';

interface LocationResult {
  address: string;
  lat: number;
  lng: number;
  district?: string;
  province?: string;
}

interface Props {
  onLocationSelect: (result: LocationResult) => void;
  initialAddress?: string;
  placeholder?: string;
}

// Nominatim search — Sri Lanka biased
async function nominatimSearch(query: string): Promise<any[]> {
  if (!query.trim() || query.length < 3) return [];
  const url = new URL('https://nominatim.openstreetmap.org/search');
  url.searchParams.set('q', query + ', Sri Lanka');
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  url.searchParams.set('limit', '6');
  url.searchParams.set('countrycodes', 'lk');
  const res = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'MediLink/1.0' }
  });
  return res.json();
}

async function reverseGeocode(lat: number, lng: number): Promise<any> {
  const url = new URL('https://nominatim.openstreetmap.org/reverse');
  url.searchParams.set('lat', String(lat));
  url.searchParams.set('lon', String(lng));
  url.searchParams.set('format', 'json');
  url.searchParams.set('addressdetails', '1');
  const res = await fetch(url.toString(), {
    headers: { 'Accept-Language': 'en', 'User-Agent': 'MediLink/1.0' }
  });
  return res.json();
}

function extractDistrict(addr: any): string {
  return addr?.county || addr?.state_district || addr?.city || '';
}

function extractProvince(addr: any): string {
  return addr?.state || '';
}

// Lazy-load Leaflet only when map is shown
let leafletLoaded = false;
async function ensureLeaflet() {
  if (leafletLoaded || typeof window === 'undefined') return;
  if (!(window as any).L) {
    await new Promise<void>((resolve) => {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
      const script = document.createElement('script');
      script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
      script.onload = () => { leafletLoaded = true; resolve(); };
      document.head.appendChild(script);
    });
  } else {
    leafletLoaded = true;
  }
}

export default function LocationPicker({ onLocationSelect, initialAddress = '', placeholder = 'Search address...' }: Props) {
  const [query, setQuery] = useState(initialAddress);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [searching, setSearching] = useState(false);
  const [showMap, setShowMap] = useState(false);
  const [pinCoords, setPinCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [mapAddress, setMapAddress] = useState('');
  const [reverseLoading, setReverseLoading] = useState(false);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const markerRef = useRef<any>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Debounced address search
  const handleQueryChange = (val: string) => {
    setQuery(val);
    clearTimeout(debounceRef.current);
    if (val.length < 3) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      setSearching(true);
      try {
        const results = await nominatimSearch(val);
        setSuggestions(results);
      } finally {
        setSearching(false);
      }
    }, 400);
  };

  const selectSuggestion = (item: any) => {
    const addr = item.display_name;
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    setQuery(addr);
    setSuggestions([]);
    setPinCoords({ lat, lng });
    onLocationSelect({
      address: addr,
      lat, lng,
      district: extractDistrict(item.address),
      province: extractProvince(item.address),
    });
  };

  // Init Leaflet map
  useEffect(() => {
    if (!showMap) return;
    let cancelled = false;

    ensureLeaflet().then(() => {
      if (cancelled || !mapContainerRef.current) return;
      const L = (window as any).L;
      if (mapRef.current) return; // already init

      // Default: centre of Sri Lanka
      const defaultLat = pinCoords?.lat ?? 7.8731;
      const defaultLng = pinCoords?.lng ?? 80.7718;
      const zoom = pinCoords ? 14 : 8;

      const map = L.map(mapContainerRef.current, { zoomControl: true }).setView([defaultLat, defaultLng], zoom);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19,
      }).addTo(map);

      // Custom pin icon
      const icon = L.divIcon({
        html: `<div style="width:32px;height:40px;position:relative">
          <svg viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg">
            <path d="M16 0C7.163 0 0 7.163 0 16c0 10 16 24 16 24s16-14 16-24C32 7.163 24.837 0 16 0z" fill="#2563eb"/>
            <circle cx="16" cy="16" r="7" fill="white"/>
          </svg>
        </div>`,
        className: '',
        iconSize: [32, 40],
        iconAnchor: [16, 40],
      });

      const marker = L.marker([defaultLat, defaultLng], { icon, draggable: true }).addTo(map);
      markerRef.current = marker;
      mapRef.current = map;

      // Drag end — reverse geocode
      marker.on('dragend', async () => {
        const { lat, lng } = marker.getLatLng();
        setPinCoords({ lat, lng });
        setReverseLoading(true);
        try {
          const result = await reverseGeocode(lat, lng);
          const addr = result.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setMapAddress(addr);
          setQuery(addr);
          onLocationSelect({
            address: addr, lat, lng,
            district: extractDistrict(result.address),
            province: extractProvince(result.address),
          });
        } finally {
          setReverseLoading(false);
        }
      });

      // Click to move pin
      map.on('click', async (e: any) => {
        const { lat, lng } = e.latlng;
        marker.setLatLng([lat, lng]);
        setPinCoords({ lat, lng });
        setReverseLoading(true);
        try {
          const result = await reverseGeocode(lat, lng);
          const addr = result.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
          setMapAddress(addr);
          setQuery(addr);
          onLocationSelect({
            address: addr, lat, lng,
            district: extractDistrict(result.address),
            province: extractProvince(result.address),
          });
        } finally {
          setReverseLoading(false);
        }
      });
    });

    return () => { cancelled = true; };
  }, [showMap]);

  // Move marker when pin coords change externally
  useEffect(() => {
    if (!mapRef.current || !markerRef.current || !pinCoords) return;
    markerRef.current.setLatLng([pinCoords.lat, pinCoords.lng]);
    mapRef.current.setView([pinCoords.lat, pinCoords.lng], 15);
  }, [pinCoords]);

  // Cleanup map on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; markerRef.current = null; }
    };
  }, []);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude: lat, longitude: lng } = pos.coords;
      setPinCoords({ lat, lng });
      setReverseLoading(true);
      try {
        const result = await reverseGeocode(lat, lng);
        const addr = result.display_name || '';
        setQuery(addr);
        setMapAddress(addr);
        onLocationSelect({
          address: addr, lat, lng,
          district: extractDistrict(result.address),
          province: extractProvince(result.address),
        });
      } finally {
        setReverseLoading(false);
      }
    });
  };

  return (
    <div className="space-y-2">
      {/* Search input */}
      <div className="relative">
        <div className="absolute left-3 top-2.5 text-gray-400">
          {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
        </div>
        <input
          className="input pl-9 pr-9"
          value={query}
          onChange={e => handleQueryChange(e.target.value)}
          placeholder={placeholder}
          autoComplete="off"
        />
        {query && (
          <button className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
            onClick={() => { setQuery(''); setSuggestions([]); }}>
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Suggestions dropdown */}
        {suggestions.length > 0 && (
          <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden">
            {suggestions.map((s, i) => (
              <button key={i} onClick={() => selectSuggestion(s)}
                className="w-full text-left px-4 py-2.5 hover:bg-blue-50 text-sm border-b border-gray-100 last:border-0 flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-blue-500 mt-0.5 flex-shrink-0" />
                <span className="truncate text-gray-700">{s.display_name}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button type="button" onClick={useMyLocation}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
          <MapPin className="w-3 h-3" /> Use my location
        </button>
        <button type="button" onClick={() => setShowMap(v => !v)}
          className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-400 transition-colors">
          {showMap ? '🗺️ Hide map' : '🗺️ Pick on map'}
        </button>
      </div>

      {/* Map */}
      {showMap && (
        <div className="rounded-xl overflow-hidden border border-gray-200 shadow-sm">
          <div ref={mapContainerRef} style={{ height: '260px', width: '100%' }} />
          {reverseLoading && (
            <div className="px-3 py-2 bg-blue-50 text-xs text-blue-700 flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" /> Getting address...
            </div>
          )}
          {mapAddress && !reverseLoading && (
            <div className="px-3 py-2 bg-gray-50 text-xs text-gray-600 flex items-center gap-1.5">
              <MapPin className="w-3 h-3 text-blue-500" />
              <span className="truncate">{mapAddress}</span>
            </div>
          )}
          <p className="px-3 py-1.5 text-xs text-gray-400 bg-white border-t border-gray-100">
            Drag the pin or click anywhere on the map to set your location
          </p>
        </div>
      )}
    </div>
  );
}
