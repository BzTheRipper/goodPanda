import React, { useState, useEffect } from 'react';
import { useAuthState } from '../Store/useAuthStore'; 
import { Link } from 'react-router-dom';
import { ArrowLeft, Satellite, MapPin, Activity, Gauge, Navigation, X } from 'lucide-react';
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default Leaflet icon missing in Vite
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// Helper component to auto-move map
const RecenterMap = ({ coords }) => {
    const map = useMap();
    useEffect(() => {
        if (coords && coords[0] !== 0 && !isNaN(coords[0])) {
            map.setView(coords, map.getZoom());
        }
    }, [coords, map]);
    return null;
};

export const GPSViewer = () => {
    const { socket, authUser, checkAuth, isCheckingAuth } = useAuthState();
    const [localTelData, setLocalTelData] = useState(null);
    const [isMapExpanded, setIsExpanded] = useState(false);

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
    const position = [lat, lon];

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
            
            {/* LEFT SIDE: Information Section */}
            <div className={`transition-all duration-500 ease-in-out p-4 overflow-y-auto h-screen ${isMapExpanded ? 'w-1/2' : 'w-full'}`}>
                <div className="max-w-md mx-auto space-y-4">
                    
                    {/* HEADER */}
                    <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                        <div className="flex items-center gap-3">
                            <Link to="/messagetest" className="p-2 bg-emerald-500/10 rounded-full text-emerald-500"><ArrowLeft size={20}/></Link>
                            <h1 className="text-xs lg:text-sm font-black tracking-widest text-emerald-400 uppercase">PANDA MONITOR</h1>
                        </div>
                        <div className={`flex items-center gap-2 px-3 py-1 rounded-full bg-black/50 border border-white/5`}>
                            <div className={`size-2 rounded-full ${socket?.connected ? 'bg-emerald-500 animate-pulse' : 'bg-red-600'}`} />
                        </div>
                    </div>

                    {/* SATELLITE STATUS CARD */}
                    <div className={`relative overflow-hidden p-6 lg:p-8 rounded-[2rem] border-2 flex flex-col items-center justify-center transition-all ${isLocked ? 'border-emerald-500 bg-emerald-500/5 shadow-[0_0_30px_rgba(16,185,129,0.1)]' : 'border-red-500/40 bg-red-500/5'}`}>
                        <Satellite size={isMapExpanded ? 32 : 48} className={isLocked ? 'text-emerald-400' : 'text-red-500'} />
                        <span className={`${isMapExpanded ? 'text-4xl' : 'text-6xl'} font-black transition-all`}>{gps.sats || 0}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.3em] mb-4">Satellites Locked</span>
                        <div className={`px-4 py-1 rounded-full text-[9px] font-black tracking-widest uppercase ${isLocked ? 'bg-emerald-500 text-black' : 'bg-red-600 text-white'}`}>
                            {gps.fix_type >= 3 ? "3D FIX SECURED" : "SEARCHING..."}
                        </div>
                    </div>

                    {/* TELEMETRY GRID - Adjusts to 1 column when map is expanded */}
                    <div className={`grid gap-3 pb-10 ${isMapExpanded ? 'grid-cols-1' : 'grid-cols-2'}`}>
                        <DataCard icon={MapPin} label="Latitude" value={lat.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={MapPin} label="Longitude" value={lon.toFixed(6)} color="text-emerald-400" />
                        <DataCard icon={Activity} label="Horizontal Acc" value={gps.eph} unit="m" />
                        <DataCard icon={Navigation} label="Vertical Acc" value={gps.epv} unit="m" />
                        <DataCard icon={Gauge} label="Ground Speed" value={gps.vel} unit="m/s" />
                        <DataCard icon={Activity} label="Relative Alt" value={gps.alt} unit="m" />
                    </div>
                </div>
            </div>

            {/* RIGHT SIDE: Map Section */}
            <div 
                className={`transition-all duration-500 ease-in-out z-[100] bg-black border-l border-emerald-500/20 
                    ${isMapExpanded 
                        ? 'w-1/2 relative h-screen' 
                        : 'absolute top-4 right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-2xl border-2 border-emerald-500/30 shadow-2xl cursor-pointer hover:border-emerald-400'
                    }`}
                onClick={() => !isMapExpanded && setIsExpanded(true)}
            >
                {/* CLOSE BUTTON (Only visible when expanded) */}
                {isMapExpanded && (
                    <button 
                        onClick={(e) => {
                            e.stopPropagation(); // Prevent re-triggering expansion
                            setIsExpanded(false);
                        }}
                        className="absolute top-4 right-4 z-[1001] bg-red-600 hover:bg-red-500 text-white p-2 rounded-full shadow-xl transition-all"
                    >
                        <X size={20} />
                    </button>
                )}

                {/* ZOOM INDICATOR (Only visible when small) */}
                {!isMapExpanded && (
                    <div className="absolute inset-0 bg-emerald-500/5 flex items-center justify-center pointer-events-none z-[1001]">
                        <span className="text-[8px] font-bold text-emerald-400/60 uppercase">Tap Map</span>
                    </div>
                )}
                
                <MapContainer 
                    center={position} 
                    zoom={15} 
                    style={{ height: '100%', width: '100%' }}
                    zoomControl={false}
                    attributionControl={false}
                >
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                    <Marker position={position} />
                    <RecenterMap coords={position} />
                </MapContainer>
            </div>

            {/* BACKGROUND DECORATION */}
            <div className="fixed inset-0 pointer-events-none shadow-[inset_0_0_100px_rgba(0,0,0,0.5)] z-[-1]" />
        </div>
    );
};