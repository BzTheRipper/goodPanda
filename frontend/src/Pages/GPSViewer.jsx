import React, { useState, useEffect } from 'react';
import { useAuthState } from '../Store/useAuthStore'; // We only need this for the socket instance
import { Link } from 'react-router-dom';
import { ArrowLeft, Satellite, MapPin, Activity, Gauge, Navigation } from 'lucide-react';

export const GPSViewer = () => {
    // 1. Get the socket from the store
    const { socket } = useAuthState();
    
    // 2. Local state for the telemetry data
    const [localTelData, setLocalTelData] = useState(null);

    // 3. Listen for telemetry directly in this component
    useEffect(() => {
        if (!socket) return;

        const handleTelemetry = (data) => {
            // console.log("Direct Telemetry Received:", data);
            setLocalTelData(data);
        };

        // Attach listener
        socket.on("telemetryMessage", handleTelemetry);

        // Clean up when leaving the page
        return () => {
            socket.off("telemetryMessage", handleTelemetry);
        };
    }, [socket]);

    // 4. Extract data from local state
    const gps = localTelData?.theTelMessage?.gps_raw || {};
    const statusMsg = localTelData?.theTelMessage?.status_msg || "OFFLINE";
    const isLocked = gps.fix_type >= 3;

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
        <div className="min-h-screen bg-[#020617] text-white p-4 font-sans selection:bg-emerald-500/30">
            <div className="max-w-md mx-auto space-y-4">
                {/* HEADER */}
                <div className="flex items-center justify-between bg-black/40 p-3 rounded-2xl border border-white/5">
                    <div className="flex items-center gap-3">
                        <Link to="/messagetest" className="p-2 bg-emerald-500/10 rounded-full text-emerald-500 hover:bg-emerald-500/20 transition-all"><ArrowLeft size={20}/></Link>
                        <h1 className="text-sm font-black tracking-widest text-emerald-400">PANDA MONITOR</h1>
                    </div>
                    <div className={`size-3 rounded-full ${isLocked ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]' : 'bg-red-600 animate-pulse shadow-[0_0_10px_#dc2626]'}`} />
                </div>

                {/* MAIN SATELLITE CARD */}
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
                    <DataCard icon={MapPin} label="Latitude" value={gps.lat?.toFixed(6)} color="text-emerald-400" />
                    <DataCard icon={MapPin} label="Longitude" value={gps.lon?.toFixed(6)} color="text-emerald-400" />
                    <DataCard icon={Activity} label="Horizontal Acc" value={gps.eph} unit="m" />
                    <DataCard icon={Navigation} label="Vertical Acc" value={gps.epv} unit="m" />
                    <DataCard icon={Gauge} label="Ground Speed" value={gps.vel} unit="m/s" />
                    <DataCard icon={Activity} label="Relative Alt" value={gps.alt} unit="m" />
                </div>

                {/* STATUS MESSAGE BOX */}
                <div className="bg-emerald-950/20 border border-emerald-500/20 p-3 rounded-xl text-center">
                    <p className="text-[9px] text-gray-500 uppercase tracking-widest mb-1">Board System Status</p>
                    <p className="text-xs font-mono font-bold text-emerald-400">{statusMsg}</p>
                </div>
            </div>
        </div>
    );
};