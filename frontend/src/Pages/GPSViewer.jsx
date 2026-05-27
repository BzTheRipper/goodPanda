import React, { useState, useEffect, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore'; 
import { Link } from 'react-router-dom';
import { ArrowLeft, Satellite, MapPin, Activity, Gauge, Navigation, X, Maximize2, Sun, Moon } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper: Moves map to follow drone
const RecenterMap = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords[0] !== 0 && !isNaN(coords[0])) {
            map.setView(coords, map.getZoom(), { animate: true });
        }
    }, [coords, map]);
    return null;
};

// Helper: Forces map to resize when container expands
const MapResizer = ({ isExpanded }) => {
    const map = useMap();
    useEffect(() => {
        setTimeout(() => { map.invalidateSize(); }, 300);
    }, [isExpanded, map]);
    return null;
};

export const GPSViewer = () => {
    const { socket, authUser, checkAuth } = useAuthState();
    const [localTelData, setLocalTelData] = useState(null);
    const [isMapExpanded, setIsExpanded] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        if (!authUser) checkAuth();
    }, [authUser, checkAuth]);

    useEffect(() => {
        if (!socket) return;
        const handleTelemetry = (data) => {
            setLocalTelData(data);
        };
        socket.on("telemetryMessage", handleTelemetry);
        return () => { socket.off("telemetryMessage", handleTelemetry); };
    }, [socket]);

    // --- DATA EXTRACTION ---
    const tel = localTelData?.theTelMessage;
    const gps = tel?.gps_raw || {};
    const isLocked = gps.fix_type >= 3;
    
    // FIX: Define statusMsg which was missing in the previous version
    const statusMsg = tel?.status_msg || "OFFLINE"; 
    
    // Coordinates
    const lat = gps.lat ? Number(gps.lat) : 31.783743854237702;
    const lon = gps.lon ? Number(gps.lon) : 35.221016797127675;
    const position = useMemo(() => [lat, lon], [lat, lon]);

    const mapTiles = isDarkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    const DataCard = ({ icon: Icon, label, value, unit, color }) => (
        <div className="bg-black/60 border border-emerald-500/10 p-4 rounded-2xl flex flex-col gap-1 shadow-lg backdrop-blur-md">
            <div className="flex items-center gap-2 text-gray-500">
                <Icon size={14} />
                <span className="text-[10px] uppercase font-bold tracking-widest">{label}</span>
            </div>
            <div className={`text-xl font-mono font-black ${color || 'text-white'}`}>
                {value ?? '---'}<span className="text-xs ml-1 text-gray-500 font-normal">{unit}</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#020617] text-white font-sans flex overflow-hidden relative">
            
            {/* LEFT SIDE: Telemetry UI */}
            <div className={`transition-all duration-500 ease-in-out p-4 overflow-y-auto h-screen ${isMapExpanded ? 'w-full lg:w-1/2' : 'w-full'}`}>
                <div className="max-w-md mx-auto space-y-4">
                    
                    {/* HEADER */}
                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <Link to="/messagetest" className="p-2 bg-emerald-500/10 rounded-full text-emerald-500 hover:bg-emerald-500/20 transition-all">
                                <ArrowLeft size={20}/>
                            </Link>
                            <h1 className="text-sm font-black tracking-widest text-emerald-400 uppercase">Panda Monitor</h1>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/5`}>
                            <span className="text-[8px] text-gray-400 uppercase font-bold">Socket</span>
                            <div className={`size-2 rounded-full ${socket?.connected ? 'bg-emerald-500 shadow-[0_0_8px_#10b981]' : 'bg-red-600 shadow-[0_0_8px_#dc2626]'}`} />
                        </div>
                    </div>

                    {/* SATELLITE STATUS CARD */}
                    <div className={`relative overflow-hidden p-8 rounded-[2.5rem] border-2 flex flex-col items-center justify-center transition-all duration-500 ${isLocked ? 'bg-emerald-500/5 border-emerald-500 shadow-[0_0_50px_rgba(16,185,129,0.1)]' : 'bg-red-500/5 border-red-500/40'}`}>
                        <Satellite size={48} className={`mb-2 ${isLocked ? 'text-emerald-400' : 'text-red-500'}`} />
                        <span className="text-6xl font-black tracking-tighter">{gps.sats || 0}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-[0.4em] mb-4">Satellites Locked</span>
                        
                        <div className="flex flex-col items-center gap-1">
                            <div className={`px-6 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase ${isLocked ? 'bg-emerald-500 text-black' : 'bg-red-600 text-white'}`}>
                                {gps.fix_type >= 3 ? "3D FIX SECURED" : "SEARCHING FOR SKY..."}
                            </div>
                            <span className="text-[10px] font-mono text-gray-500 uppercase">Fix Type: {gps.fix_type || 0}</span>
                        </div>
                    </div>

                    {/* TELEMETRY GRID */}
                    <div className="grid grid-cols-2 gap-3">
                        <DataCard icon={MapPin} label="Latitude" value={lat.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={MapPin} label="Longitude" value={lon.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={Activity} label="Horizontal Acc" value={gps.eph} unit="m" />
                        <DataCard icon={Navigation} label="Vertical Acc" value={gps.epv} unit="m" />
                        <DataCard icon={Gauge} label="Ground Speed" value={gps.vel} unit="m/s" />
                        <DataCard icon={Activity} label="Relative Alt" value={gps.alt} unit="m" />
                    </div>

                    {/* STATUS MESSAGE BOX */}
                    <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl text-center shadow-inner">
                        <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Hardware Status</p>
                        <p className={`text-xs font-mono font-bold ${socket?.connected ? 'text-emerald-400' : 'text-red-500 animate-pulse'}`}>
                            {socket?.connected ? statusMsg : "CLOUD DISCONNECTED"}
                        </p>
                    </div>
                </div>
            </div>

            {/* --- RIGHT SIDE: DYNAMIC MAP --- */}
            <div 
                onClick={() => !isMapExpanded && setIsExpanded(true)}
                className={`transition-all duration-500 ease-in-out z-[50] bg-black border-l border-emerald-500/20 
                    ${isMapExpanded 
                        ? 'w-full lg:w-1/2 relative h-screen opacity-100' 
                        : 'absolute top-4 right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-2xl border-2 border-emerald-500/30 shadow-2xl cursor-pointer hover:border-emerald-400'
                    }`}
            >
                <div className="absolute top-3 left-3 right-3 flex justify-between z-[1001]">
                    <button 
                        onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }}
                        className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-emerald-400 hover:text-white transition-all shadow-lg active:scale-90"
                    >
                        {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                    </button>

                    {isMapExpanded && (
                        <button 
                            onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }}
                            className="bg-red-600 text-white p-1.5 rounded-lg shadow-xl"
                        >
                            <X size={18} />
                        </button>
                    )}
                </div>

                {!isMapExpanded && (
                    <div className="absolute inset-0 bg-emerald-500/5 flex items-center justify-center pointer-events-none z-[1000]">
                        <Maximize2 size={16} className="text-emerald-400/50" />
                    </div>
                )}
                
                <MapContainer 
                    center={position} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%', background: '#020617' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer url={mapTiles} />
                    
                    {/* Unique Key ensures the Marker re-renders at new position instantly */}
                    <Marker position={position} key={`${lat}-${lon}`} />
                    
                    <RecenterMap coords={position} />
                    <MapResizer isExpanded={isMapExpanded} />
                </MapContainer>
            </div>

            <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] z-[-1]" />
        </div>
    );
};