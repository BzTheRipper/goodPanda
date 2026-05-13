import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore'; 
import { Link } from 'react-router-dom';
import { ArrowLeft, Satellite, MapPin, Activity, Gauge, Navigation, X, Sun, Moon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- MAP UTILITIES ---
const RecenterMap = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords[0] !== 0 && !isNaN(coords[0])) {
            map.flyTo(coords, map.getZoom(), { animate: true, duration: 0.5 });
        }
    }, [coords, map]);
    return null;
};

const MapResizer = ({ isExpanded }) => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => { map.invalidateSize(); }, 300);
    }, [isExpanded, map]);
    return null;
};

export const GPSViewer = () => {
    const { socket, authUser, checkAuth, isCheckingAuth } = useAuthState();
    const [localTelData, setLocalTelData] = useState(null);
    const [isMapExpanded, setIsExpanded] = useState(false);
    
    // 1. Theme State for Map
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        if (!authUser && !isCheckingAuth) checkAuth();
    }, [authUser, isCheckingAuth, checkAuth]);

    useEffect(() => {
        if (!socket) return;
        const handleTelemetry = (data) => setLocalTelData(data);
        socket.on("telemetryMessage", handleTelemetry);
        return () => { socket.off("telemetryMessage", handleTelemetry); };
    }, [socket]);

    if (isCheckingAuth) return null;

    const tel = localTelData?.theTelMessage;
    const gps = tel?.gps_raw || {};
    const isLocked = gps.fix_type >= 3;
    
    const lat = parseFloat(gps.lat) || 31.783743854237702;
    const lon = parseFloat(gps.lon) || 35.221016797127675;
    const position = useMemo(() => [lat, lon], [lat, lon]);

    // 2. Tile URLs
    const mapTiles = isDarkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    const DataCard = ({ icon: Icon, label, value, unit, color }) => (
        <div className="bg-black/60 border border-emerald-500/10 p-3 lg:p-4 rounded-2xl flex flex-col gap-1 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2 text-gray-500">
                <Icon size={14} />
                <span className="text-[9px] lg:text-[10px] uppercase font-bold tracking-widest">{label}</span>
            </div>
            <div className={`text-sm lg:text-xl font-mono font-black ${color || 'text-white'}`}>
                {value ?? '---'}<span className="text-[10px] ml-1 text-gray-500 font-normal">{unit}</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans flex overflow-hidden">
            
            {/* LEFT SIDE: Info */}
            <div className={`transition-all duration-500 ease-in-out p-4 overflow-y-auto h-screen ${isMapExpanded ? 'w-1/2 opacity-40 grayscale-[0.5]' : 'w-full'}`}>
                <div className="max-w-md mx-auto space-y-4">
                    <header className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                        <Link to="/messagetest" className="p-2 bg-emerald-500/10 rounded-full text-emerald-500"><ArrowLeft size={20}/></Link>
                        <h1 className="text-xs font-black tracking-widest text-emerald-400 uppercase">Panda Monitor</h1>
                        <div className={`size-2 rounded-full ${socket?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-600'}`} />
                    </header>

                    <div className={`relative p-6 rounded-[2rem] border-2 flex flex-col items-center justify-center transition-all ${isLocked ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_30px_#10b98133]' : 'border-red-500/40 bg-red-500/5'}`}>
                        <Satellite size={32} className={isLocked ? 'text-emerald-400' : 'text-red-500'} />
                        <span className="text-4xl font-black">{gps.sats || 0}</span>
                        <p className="text-[9px] font-black uppercase mt-2 tracking-widest">{isLocked ? "3D FIX SECURED" : "SEARCHING..."}</p>
                    </div>

                    <div className={`grid gap-2 ${isMapExpanded ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <DataCard icon={MapPin} label="Latitude" value={lat.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={MapPin} label="Longitude" value={lon.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={Gauge} label="Ground Speed" value={gps.vel} unit="m/s" />
                        <DataCard icon={Activity} label="Relative Alt" value={gps.alt} unit="m" />
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: Map Section */}
            <div 
                className={`transition-all duration-500 ease-in-out z-[100] bg-black 
                    ${isMapExpanded 
                        ? 'w-1/2 relative h-screen border-l border-emerald-500/40' 
                        : 'absolute top-4 right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-2xl border-2 border-emerald-500/30 shadow-2xl cursor-pointer'
                    }`}
                onClick={() => !isMapExpanded && setIsExpanded(true)}
            >
                {/* 3. THEME TOGGLE SWITCH (Top Left of Map) */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation(); // Prevents expanding the map when toggling
                        setIsDarkMode(!isDarkMode);
                    }}
                    className="absolute top-3 left-3 z-[1001] bg-black/60 backdrop-blur-md p-2 rounded-xl border border-white/10 text-emerald-400 hover:text-white transition-all shadow-lg active:scale-90"
                    title={isDarkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
                >
                    {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                </button>

                {/* CLOSE BUTTON (Top Right) */}
                {isMapExpanded && (
                    <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="absolute top-3 right-3 z-[1001] bg-red-600 hover:bg-red-500 text-white p-2 rounded-xl shadow-xl"><X size={20}/></button>
                )}
                
                <MapContainer 
                    center={position} 
                    zoom={16} 
                    style={{ height: '100%', width: '100%', background: '#020617' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer url={mapTiles} />
                    <Marker position={position} />
                    <RecenterMap coords={position} />
                    <MapResizer isExpanded={isMapExpanded} />
                </MapContainer>
            </div>
        </div>
    );
};