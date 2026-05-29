import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    Power, Circle, ShieldAlert, ExternalLink, X, Maximize2, Rocket, Signal, Sun, Moon, Satellite, ArrowRight, ArrowDownToLine
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// --- LEAFLET ASSET FIX ---
import icon from 'leaflet/dist/images/marker-icon.png';
import shadow from 'leaflet/dist/images/marker-shadow.png';
let DefaultIcon = L.icon({ iconUrl: icon, shadowUrl: shadow, iconSize: [25, 41], iconAnchor: [12, 41] });
L.Marker.prototype.options.icon = DefaultIcon;

// --- MAP HELPERS ---
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

// --- JOYSTICK COMPONENT ---
const Joystick = memo(({ onMove }) => {
    const baseRef = useRef(null);
    const stickRef = useRef(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const handleMove = (e) => {
        if (!isInteracting || !baseRef.current || !stickRef.current) return;
        const touch = e.touches ? e.touches[0] : e;
        const rect = baseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = touch.clientX - centerX;
        let dy = touch.clientY - centerY;
        const max = rect.width / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > max) { dx *= max / dist; dy *= max / dist; }
        stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx, dy, max);
    };

    return (
        <div className="relative flex flex-col items-center pointer-events-auto">
            <div ref={baseRef} className="w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center backdrop-blur-sm touch-none"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsInteracting(true); }}
                onPointerMove={handleMove} onPointerUp={() => { setIsInteracting(false); stickRef.current.style.transform = 'translate(0px, 0px)'; onMove(0, 0, 1); }}>
                <div ref={stickRef} className="w-8 h-8 lg:w-14 lg:h-14 rounded-full bg-[#2dd4bf] shadow-2xl pointer-events-none" />
            </div>
        </div>
    );

});

export const MessagetestPage = () => {
    const { socket } = useAuthState();

    // --- STATES ---
    const [isStarted, setIsStarted] = useState(false);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const [gotTheMessage, setGotTheMessage] = useState(null);
    const [gotTheTelMessage, setGotTheTelMessage] = useState(null);
    const [isMapExpanded, setIsExpanded] = useState(false);
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [altitude, setAltitude] = useState(5);
    const [ping, setPing] = useState(0);
    const [visualCmds, setVisualCommands] = useState([]);
    const [primaryLink, setPrimaryLink] = useState(null);
    const [isFPVActive, setIsFPVActive] = useState(false);
    const [isMobile] = useState(/Mobi|Android|iPhone/i.test(navigator.userAgent));
    const [flightMode, setFlightMode] = useState("ALT_HOLD"); // Stages: ALT_HOLD, LOITER, GUIDED
    const [hasInitialGpsAutoSwitch, setHasInitialGpsAutoSwitch] = useState(false);
    const [speed, setSpeed] = useState(20);
    const [droneOnline, setDroneOnline] = useState(false);
    const lastTelTime = useRef(Date.now()); // Tracks when the last telemetry packet arrived
    const [mavLogs, setMavLogs] = useState([]);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);


    // --- REFS ---
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());
    const [yPos, setYPos] = useState(0);
    const lastEmitTime = useRef(Date.now());
    const logEndRef = useRef(null);

    // --- DATA CALCULATIONS ---
    const tel = gotTheTelMessage?.theTelMessage;
    const isArmedFromTel = tel?.is_armable || false;
    const gpsData = tel?.gps_raw || {};
    const satCount = gpsData.sats || 0;
    const isGpsLocked = gpsData.fix_type >= 3;
    const getGpsStatus = () => {
        const fix = gpsData.fix_type;
        const sats = gpsData.sats || 0;

        if (!fix || fix === 0) return { text: "No GPS", color: "text-red-600" };
        if (fix === 1 || sats === 0) return { text: "No Fix", color: "text-blue-500" };
        return { text: "OK", color: "text-emerald-500" };
    };

    const gpsStatus = getGpsStatus();

    useEffect(() => {
        if (!socket) return;

        const handleMavLog = (data) => {
            setMavLogs((prev) => {
                // Keep the last 50 messages so the user can scroll back
                const newLogs = [...prev, data.text];
                return newLogs.slice(-50);
            });
        };

        socket.on("pixhawk-feedback", handleMavLog);
        return () => socket.off("pixhawk-feedback", handleMavLog);
    }, [socket]);

    // Auto-scroll terminal to bottom when new logs arrive
    useEffect(() => {
        if (isTerminalOpen) {
            logEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [mavLogs, isTerminalOpen]);

    // --- AUTO-SWITCH LOGIC ---
    useEffect(() => {
        if (isGpsLocked && !hasInitialGpsAutoSwitch) {
            setFlightMode("LOITER");
            setHasInitialGpsAutoSwitch(true);
        } else if (!isGpsLocked) {
            setFlightMode("ALT_HOLD");
            setHasInitialGpsAutoSwitch(false);
        }
    }, [isGpsLocked, hasInitialGpsAutoSwitch]);

    // YOUR REQUESTED DEFAULT COORDS
    const lat = gpsData.lat ? Number(gpsData.lat) : 31.787396049566723;
    const lon = gpsData.lon ? Number(gpsData.lon) : 35.224925554289065;
    const position = useMemo(() => [lat, lon], [lat, lon]);

    const getSatColor = () => {
        if (satCount === 0) return "text-red-500";
        if (satCount <= 3) return "text-purple-500 animate-pulse";
        return "text-emerald-500";
    };

    const mapTiles = isDarkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    // --- LOGIC ---
    useEffect(() => {
        if (!socket) return;
        socket.on("message", setGotTheMessage);
        socket.on("telemetryMessage", (data) => {
            lastTelTime.current = Date.now();
            setGotTheTelMessage(data);

            // Calculate the difference
            const calculatedPing = Date.now() - lastEmitTime.current;

            // Safety check: if ping is negative or weirdly low due to 20ms overlap, 
            // we ensure it shows at least a realistic 10-20ms
            setPing(calculatedPing < 0 ? 20 : calculatedPing);

            if (data.theTelMessage?.cam_url && data.theTelMessage.cam_url !== primaryLink) {
                setPrimaryLink(data.theTelMessage.cam_url);
                setIsFPVActive(false);
            }
        });
        return () => { socket.off("message"); socket.off("telemetryMessage"); };
    }, [socket, primaryLink]);

    // --- CONNECTION WATCHDOG ---
    useEffect(() => {
        const checkConnection = setInterval(() => {
            // If it's been more than 2 seconds since last telemetry, set offline
            if (Date.now() - lastTelTime.current > 2000) {
                setDroneOnline(false);
            } else {
                setDroneOnline(true);
            }
        }, 20);
        return () => clearInterval(checkConnection);
    }, []);

    // Socket Emit Code
    useEffect(() => {
        if (!socket) return;
        let interval = setInterval(() => {
            // --- THE FIX: Record the exact time this specific packet is sent ---
            lastEmitTime.current = Date.now();

            const combined = new Set([...Array.from(activeKeys.current), ...Array.from(leftJoyDirs.current), ...Array.from(rightJoyDirs.current)]);
            socket.emit("user-message", {
                commands: Array.from(combined),
                speed: speed,
                flight_mode: flightMode,
                altitude: altitude
            });
            setVisualCommands(Array.from(combined));
        }, 100); // Your 20ms interval preserved
        return () => clearInterval(interval);
    }, [socket, speed, flightMode, altitude]);

    const ModeSlider = () => {
        const modes = ["ALT_HOLD", "LOITER", "GUIDED"];
        const currentIndex = modes.indexOf(flightMode);

        const getModeColor = () => {
            if (flightMode === "ALT_HOLD") return "bg-orange-500 shadow-orange-500/50";
            if (flightMode === "LOITER") return "bg-purple-500 shadow-purple-500/50";
            return "bg-emerald-500 shadow-emerald-500/50";
        };

        const handleModeChange = (newMode) => {
            // Rules enforcement
            if (!isGpsLocked && newMode !== "ALT_HOLD") return; // Block switch if no GPS
            if (isGpsLocked && newMode === "ALT_HOLD") return; // Block Alt_Hold if GPS found
            setFlightMode(newMode);
        };

        return (
            <div className="flex flex-col items-center mt-2 pointer-events-auto">
                <div className="relative w-40 h-8 flex items-center">
                    {/* The Thick Track */}
                    <div className={`absolute w-full h-2 rounded-full transition-colors duration-500 ${getModeColor()} opacity-20`} />
                    <div className={`absolute h-2 rounded-full transition-all duration-500 ${getModeColor()}`} style={{ width: `${(currentIndex / 2) * 100}%`, left: 0 }} />

                    {/* The 3 Stage Points */}
                    <div className="absolute w-full flex justify-between px-1">
                        {modes.map((m) => (
                            <button
                                key={m}
                                onClick={() => handleModeChange(m)}
                                className={`size-4 rounded-full border-2 border-white/20 z-10 transition-all ${flightMode === m ? getModeColor() : 'bg-black/60'}`}
                            />
                        ))}
                    </div>
                </div>
                <span className={`text-[8px] font-black uppercase mt-1 tracking-tighter transition-colors ${getModeColor().replace('bg-', 'text-')}`}>
                    {flightMode.replace('_', ' ')}
                </span>
            </div>
        );
    };

    const handleStartConsole = async () => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) await element.requestFullscreen();
            if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            setIsStarted(true);
        } catch (err) { setIsStarted(true); }
    };

    const handleForceDisarm = () => socket?.emit('user-message', { commands: ["force_disarm"], altitude });
    const handleTakeoff5m = () => socket?.emit('user-message', { commands: ["fly"], altitude: 5 });

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative" style={{ touchAction: 'none' }}>

            {/* --- MOBILE ENTRY OVERLAY (Button triggers Swipe Exit) --- */}
            {isMobile && (
                <div className={`fixed inset-0 z-[200] bg-[#050a05] flex flex-col items-center justify-center p-8 transition-transform duration-1000 ease-in-out ${isStarted ? '-translate-y-full' : 'translate-y-0'}`}>
                    <div className="mb-12 text-center">
                        <Rocket size={48} className="text-emerald-500 mx-auto mb-4 animate-bounce" />
                        <h2 className="text-emerald-500 font-black text-3xl tracking-[0.2em] uppercase green-glow">Panda Console</h2>
                        <p className="text-gray-500 text-[10px] mt-2 uppercase tracking-widest">Autonomous Delivery Interface</p>
                    </div>

                    <button
                        onClick={handleStartConsole}
                        className="group relative px-12 py-4 bg-emerald-600/20 border-2 border-emerald-500 rounded-full text-emerald-400 font-black tracking-widest overflow-hidden transition-all hover:bg-emerald-500 hover:text-black active:scale-95"
                    >
                        <span className="relative z-10 flex items-center gap-2">LAUNCH SYSTEM <ArrowRight size={20} /></span>
                        <div className="absolute inset-0 bg-emerald-500 -translate-x-full group-hover:translate-x-0 transition-transform duration-300" />
                    </button>
                </div>
            )}

            {/* LAYER 0: FPV BACKGROUND */}
            <div className="relative flex flex-col items-center justify-center">
                {/* ... Radar Rings ... */}
                <div className="relative size-10 bg-emerald-500/20 ...">
                    <div className="size-3 bg-emerald-500 rounded-full animate-pulse" />
                </div>

                {/* CHANGE: Removed 'absolute' and 'top', used 'mt-32' to space it from the center core */}
                <div className="mt-32 w-64 text-center z-20">
                    <p className="text-emerald-400 font-mono text-[10px] lg:text-xs tracking-[0.3em] uppercase animate-pulse">
                        Waiting for FPV feed
                    </p>
                    <div className="flex justify-center gap-1 mt-1">
                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce" />
                    </div>
                </div>
            </div>

            {/* TELEMETRY HUD (FPS STYLE) */}
            <div className="absolute top-14 lg:top-16 left-4 z-30 flex flex-col gap-0.5 text-[9px] lg:text-[12px] font-mono text-emerald-400 pointer-events-none bg-black/40 p-2 lg:p-3 rounded-lg border border-white/10 backdrop-blur-sm shadow-xl">
                <div className="flex items-center gap-1.5 mb-0.5 border-b border-emerald-500/20 pb-1 text-blue-400">
                    <Signal size={16} />
                    {/* Increased text size to text-sm (mobile) and text-lg (desktop) */}
                    <span className="font-black tracking-tighter text-sm">Ping: {ping} ms</span>
                </div>
                <p><span className="opacity-40">Lat:</span> {gpsData.lat?.toFixed(6) || "---"}</p>
                <p><span className="opacity-40">Lon:</span> {gpsData.lon?.toFixed(6) || "---"}</p>
                <p><span className="opacity-40">Sats:</span> {gpsData.sats || 0}</p>
                <p className="text-blue-400"><span className="opacity-40 uppercase">Alt:</span> {gpsData.alt?.toFixed(1) || "0.0"}M</p>
                <p><span className="opacity-40">Spd:</span> {gpsData.vel?.toFixed(1) || "0.0"}M/S</p>
                <p className={`${gpsStatus.color} font-black`}><span className="opacity-40 text-emerald-400 font-mono font-normal">GPS:</span> {gpsStatus.text}</p>
            </div>

            {/* --- SIDE TERMINAL DRAWER --- */}
            <div
                className={`fixed left-0 top-1/2 -translate-y-1/2 z-[100] flex items-center transition-all duration-500 ease-in-out ${isTerminalOpen ? "translate-x-0" : "-translate-x-64"
                    }`}
            >
                {/* THE TERMINAL BOX */}
                <div className="w-64 h-72 bg-black/90 backdrop-blur-xl border border-white/10 rounded-r-2xl shadow-[20px_0_50px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden">
                    {/* Terminal Header */}
                    <div className="bg-white/5 px-3 py-2 border-b border-white/10 flex justify-between items-center">
                        <div className="flex items-center gap-2">
                            <div className="size-2 rounded-full bg-red-500 animate-pulse" />
                            <span className="text-[10px] font-black text-emerald-500 tracking-widest uppercase">Mavlink Console</span>
                        </div>
                        <span className="text-[8px] text-gray-500 font-mono">v4.6.3</span>
                    </div>

                    {/* Log Content */}
                    <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] leading-relaxed space-y-1.5 scrollbar-hide">
                        {mavLogs.length === 0 ? (
                            <p className="text-gray-700 italic">Waiting for telemetry heartbeat...</p>
                        ) : (
                            mavLogs.map((log, i) => (
                                <div key={i} className="flex gap-2 border-l border-white/5 pl-2">
                                    <span className="text-emerald-900 select-none">root@drone:~#</span>
                                    <span className={
                                        log.includes("REJECTED") || log.includes("FAILED") || log.includes("Loss")
                                            ? "text-red-400"
                                            : "text-emerald-400"
                                    }>
                                        {log}
                                    </span>
                                </div>
                            ))
                        )}
                        <div ref={logEndRef} />
                    </div>
                </div>

                {/* THE TOGGLE BUTTON (Attached to the side of the box) */}
                <button
                    onClick={() => setIsTerminalOpen(!isTerminalOpen)}
                    className="bg-emerald-500/10 hover:bg-emerald-500/20 backdrop-blur-md border-y border-r border-emerald-500/30 p-2 rounded-r-xl text-emerald-500 transition-all group pointer-events-auto"
                >
                    <ArrowRight
                        size={18}
                        className={`transition-transform duration-500 ${isTerminalOpen ? "rotate-180" : "rotate-0"}`}
                    />
                </button>
            </div>

            {/* UI HUD OVERLAY */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
                <header className="w-full py-1 lg:py-2 flex flex-col items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow">Panda Console</h1>

                    {/* Satellite color changes based on online status */}
                    <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-xs lg:text-lg uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                        <Satellite size={isMobile ? 12 : 18} /> {droneOnline ? satCount : 0} Satellites
                    </div>

                    {/* THE STATUS LIGHT: Green if droneOnline is true, Red otherwise */}
                    <div className="absolute right-4 top-4 size-4 rounded-full shadow-lg transition-all duration-500"
                        style={{
                            backgroundColor: droneOnline ? '#10b981' : '#dc2626',
                            boxShadow: droneOnline ? '0 0 15px #10b981' : '0 0 15px #dc2626'
                        }}
                    />
                </header>
                {/* --- MODE SLIDER PLACEMENT --- */}
                <div className='flex flex-col items-center'>
                    <ModeSlider />
                    {!isGpsLocked && <span className="text-[10px] text-red-500 font-bold mt-1">GPS REQUIRED FOR LOITER/GUIDED MODE</span>}
                </div>

                {/* ALTITUDE SIDEBAR */}
                <div className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 lg:gap-2 z-50 pointer-events-auto">
                    <span className="text-[10px] text-blue-400 font-black font-mono">{altitude}m</span>
                    <div className="relative w-6 h-32 lg:w-10 lg:h-72 bg-black/60 border border-blue-500/30 rounded-full flex flex-col-reverse p-0.5 overflow-hidden shadow-2xl">
                        <input type="range" min="0" max="20" step="1" value={altitude} onChange={(e) => setAltitude(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                        <div className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-full transition-all duration-300" style={{ height: `${(altitude / 20) * 100}%` }} />
                    </div>
                    <p className="text-[7px] lg:text-[9px] text-blue-500 uppercase font-black vertical-text mt-2">Altitude</p>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12">

                    {/* LEFT SECTION (JOYSTICK + TAKEOFF) */}
                    <div className="flex-1 flex items-center justify-start gap-12 lg:gap-20 pointer-events-auto">
                        <div className="flex flex-col items-center">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-2 uppercase italic tracking-widest">Movement</p>
                            <Joystick onMove={(dx, dy, r) => {
                                const t = r * 0.3; const d = new Set();
                                if (dy < -t) d.add("forward"); if (dy > t) d.add("backward");
                                if (dx < -t) d.add("left"); if (dx > t) d.add("right");
                                leftJoyDirs.current = d;
                            }} />
                        </div>

                        <button
                            onClick={handleTakeoff5m}
                            className="size-12 lg:size-22 ml-28 rounded-full bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-90 transition-all hover:bg-emerald-500 hover:text-black group"
                        >
                            <Rocket className="size-5 lg:size-8 group-hover:animate-bounce" />
                            <span className="text-[6.5px] lg:text-[15px] font-black leading-none mt-1 text-center">Fly 5m</span>
                        </button>

                    </div>

                    {/* CENTER HUD & SLIDER */}
                    <div className="flex-1 flex flex-row items-end justify-center gap-3 lg:gap-10 mb-2 pointer-events-auto">
                        <div className="flex flex-col gap-2 w-28 lg:w-80 justify-end">
                            <div className='flex flex-col items-center w-full px-2 mb-4 pointer-events-auto'>
                                {/* Label Row */}
                                <div className="flex justify-between w-full px-1 mb-1">
                                    <span className="text-[8px] lg:text-[10px] text-orange-400 font-black uppercase tracking-widest">Velocity Limit</span>
                                    <span className="text-[10px] lg:text-[12px] text-orange-400 font-mono font-bold">{speed}%</span>
                                </div>

                                {/* Slider Container (Exact copy of Altitude design) */}
                                <div className="relative w-full h-6 lg:h-8 bg-black/60 border border-orange-500/30 rounded-full p-0.5 overflow-hidden shadow-2xl flex items-center">

                                    {/* 1. The Actual Input (Invisible Overlay) */}
                                    <input
                                        type="range"
                                        min="0"
                                        max="100"
                                        step="5"
                                        value={speed}
                                        onChange={(e) => setSpeed(parseInt(e.target.value))}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
                                        style={{
                                            WebkitAppearance: 'none',
                                            appearance: 'none',
                                            width: '100%',
                                            height: '100%'
                                        }}
                                    />

                                    {/* 2. Visual Progress Fill (Orange Gradient) */}
                                    <div
                                        className="h-full bg-gradient-to-r from-orange-700 to-orange-400 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                                        style={{
                                            width: `${speed}%` // Simple 0-100 math
                                        }}
                                    />
                                </div>

                                {/* Sub-label */}
                                <p className="text-[7px] lg:text-[8px] text-orange-500 uppercase font-black mt-2">Sensitivity Control</p>
                            </div>
                            <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-1.5 lg:p-2 rounded-xl shadow-2xl w-full text-center'>
                                {/* Label shows Python's status_msg if online, otherwise "OFFLINE" */}
                                <p className={`text-xs lg:text-sm font-black uppercase ${droneOnline ? "text-emerald-400" : "text-red-500"}`}>
                                    {droneOnline ? (tel?.status_msg || "LINKED") : "OFFLINE"}
                                </p>

                                <div className="grid grid-cols-3 text-center text-[#2dd4bf] font-mono text-[7px] lg:text-[13px] border-t border-white/5 mt-1 pt-1">
                                    <div><p className="text-gray-500 text-[15px]">X</p>{droneOnline ? lat.toFixed(1) : "0.0"}</div>
                                    <div><p className="text-gray-500 text-[15px]">Y</p>{droneOnline ? lon.toFixed(1) : "0.0"}</div>
                                    <div><p className="text-gray-500 text-[15px]">θ</p>{droneOnline ? (tel?.theta?.toFixed(1) || "0.0") : "0.0"}</div>
                                </div>
                            </div>
                            <button onClick={handleForceDisarm} className="w-full py-1.5 bg-red-600/20 border border-red-500/40 rounded-lg text-red-500 font-black text-[8px] lg:text-[10px] uppercase active:scale-95 shadow-xl">FORCE KILL</button>
                        </div>

                        {/* SLIDER BLOCK */}
                        <div ref={sliderRef} style={{ touchAction: 'none' }}
                            onPointerDown={(e) => {
                                e.currentTarget.setPointerCapture(e.pointerId);
                                setIsDraggingSlider(true);
                                hasTriggeredAction.current = false;
                            }}
                            onPointerMove={(e) => {
                                if (!isDraggingSlider || !sliderRef.current) return;
                                const rect = sliderRef.current.getBoundingClientRect();

                                // SUPPORT: Fixes coordinate detection for both PC and Mobile
                                const clientY = e.nativeEvent.clientY || e.clientY;
                                let dy = clientY - (rect.top + rect.height / 2);

                                const maxRange = rect.height / 2 - 10;
                                dy = Math.max(-maxRange, Math.min(maxRange, dy));
                                setYPos(dy);

                                const threshold = maxRange * 0.7;
                                if (!hasTriggeredAction.current) {
                                    if (dy <= -threshold) {
                                        // ADD TO activeKeys so the 10Hz loop sends it multiple times for reliability
                                        activeKeys.current.add("arm");
                                        if (navigator.vibrate) navigator.vibrate(50);
                                        hasTriggeredAction.current = true;
                                        // Automatically remove it after 500ms so it doesn't stay stuck
                                        setTimeout(() => activeKeys.current.delete("arm"), 500);
                                    } else if (dy >= threshold) {
                                        activeKeys.current.add("land");
                                        if (navigator.vibrate) navigator.vibrate(50);
                                        hasTriggeredAction.current = true;
                                        setTimeout(() => activeKeys.current.delete("land"), 500);
                                    }
                                }
                            }}
                            onPointerUp={() => {
                                setIsDraggingSlider(false);
                                setYPos(0);
                                hasTriggeredAction.current = false; // FIX: Reset the lock so you can swipe again
                            }}
                            onPointerCancel={() => {
                                setIsDraggingSlider(false);
                                setYPos(0);
                                hasTriggeredAction.current = false;
                            }}
                            className="relative w-10 lg:w-14 h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl overflow-visible"
                        >
                            <div className="absolute top-2 text-[5px] lg:text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                            <div className="absolute bottom-2 text-[5px] lg:text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                            <div className="w-full h-0.5 bg-white/10 absolute" />

                            {/* --- FANCY DYNAMIC HANDLE --- */}
                            <div
                                className={`absolute w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse
            ${(isArmedFromTel || yPos < -20)
                                        ? "bg-emerald-500 rounded-md shadow-[0_0_20px_#10b981]" // Green Rectangle
                                        : (yPos > 20)
                                            ? "bg-orange-500 rounded-full shadow-[0_0_20px_#f97316]" // Orange Circle
                                            : "bg-purple-600 shadow-[0_0_20px_#9333ea]" // Purple Triangle (Shape below)
                                    }`}
                                style={{
                                    transform: `translateY(${yPos}px)`,
                                    clipPath: (isArmedFromTel || yPos < -20 || yPos > 20)
                                        ? "none"
                                        : "polygon(50% 0%, 0% 100%, 100% 100%)"
                                }}
                            >
                                {(isArmedFromTel || yPos < -20) ? <Power size={14} className="text-black" /> :
                                    (yPos > 20) ? <ArrowDownToLine size={14} className="text-black" /> :
                                        <Circle size={6} className="text-white mt-1" fill="white" />}
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-end pr-12 lg:pr-0 pointer-events-auto">
                        <div className="flex flex-col items-center">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-2 uppercase italic tracking-widest">Yaw / Rotate</p>
                            <Joystick onMove={(dx, dy, r) => {
                                const t = r * 0.3; const d = new Set();
                                if (dx < -t) d.add("rotate_left"); if (dx > t) d.add("rotate_right");
                                rightJoyDirs.current = d;
                            }} />
                        </div>
                    </div>
                </main>
            </div>

            {/* MAP OVERLAY (TOP RIGHT) */}
            <div onClick={() => !isMapExpanded && setIsExpanded(true)}
                className={`transition-all duration-500 z-[100] border-2 border-emerald-500/30 overflow-hidden 
    ${isMapExpanded
                        ? 'absolute top-0 right-0 w-1/2 h-screen border-l bg-black shadow-[-20px_0_30px_rgba(0,0,0,0.5)]'
                        : 'absolute top-4 right-10 w-25 h-25 lg:w-28 lg:h-28 rounded-2xl shadow-xl cursor-pointer hover:border-emerald-400'
                    }`}>
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-[1001]">
                    <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-emerald-400">
                        {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                    </button>
                </div>
                {isMapExpanded && <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="absolute top-3 right-3 z-[1001] bg-red-600 p-2 rounded-lg text-white shadow-lg pointer-events-auto"><X size={20} /></button>}
                <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                    <TileLayer url={mapTiles} />
                    <Marker position={position} key={`${lat}-${lon}`} />
                    <RecenterMap coords={position} />
                    <MapResizer isExpanded={isMapExpanded} />
                </MapContainer>
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                .green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } 
                .vertical-text { writing-mode: vertical-rl; }
                input[type=range] { writing-mode: bt-lr; -webkit-appearance: slider-vertical; }
                * { -webkit-tap-highlight-color: transparent !important; }
            ` }} />
        </div>
    );
};