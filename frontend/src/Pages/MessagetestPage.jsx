import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    Power, Circle, ShieldAlert, ExternalLink, X, Maximize2, Rocket, Signal, Sun, Moon, Satellite, ArrowRight, ArrowDownToLine
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polyline } from 'react-leaflet';
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
            <div ref={baseRef} className="w-32 h-32 lg:w-56 lg:h-56 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center backdrop-blur-sm touch-none"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsInteracting(true); }}
                onPointerMove={handleMove} onPointerUp={() => { setIsInteracting(false); stickRef.current.style.transform = 'translate(0px, 0px)'; onMove(0, 0, 1); }}>
                <div ref={stickRef} className="w-12 h-12 lg:w-20 lg:h-20 rounded-full bg-[#2dd4bf] shadow-2xl pointer-events-none" />
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
    const [missionExecuted, setMissionExecuted] = useState(false);
    const lastTelTime = useRef(Date.now()); // Tracks when the last telemetry packet arrived
    const [mavLogs, setMavLogs] = useState([]);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [targetPos, setTargetPos] = useState(null);
    const [targetColor, setTargetColor] = useState('#10b981');
    const [markerPoints, setMarkerPoints] = useState([]);
    const [coordInput, setCoordInput] = useState("");
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [isLeftBarOpen, setIsLeftBarOpen] = useState(true);
    const [isRightBarOpen, setIsRightBarOpen] = useState(true);

    const handleClearTarget = useCallback(() => {
        setTargetPos(null);
        setMarkerPoints([]);
    }, []);




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

    

    const getRandomColor = () => {
        const colors = ['#f87171', '#fb923c', '#fbbf24', '#a3e635', '#22d3ee', '#818cf8', '#c084fc', '#f472b6', '#10b981'];
        return colors[Math.floor(Math.random() * colors.length)];
    };

    const addMarkerPoint = (coords) => {
        setTargetPos(coords);
        setTargetColor(getRandomColor());
        setMarkerPoints([coords]);
    };

    const createColoredIcon = (color) => L.divIcon({
        html: `<svg width="25" height="41" viewBox="0 0 25 41" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M12.5 0C5.59645 0 0 5.59645 0 12.5C0 21.875 12.5 41 12.5 41C12.5 41 25 21.875 25 12.5C25 5.59645 19.4036 0 12.5 0Z" fill="${color}"/><circle cx="12.5" cy="12.5" r="5" fill="black" fill-opacity="0.3"/></svg>`,
        className: "",
        iconSize: [25, 41],
        iconAnchor: [12, 41]
    });

    // Helper: Catch Map Clicks
    const MapClickHandler = ({ onTargetClear }) => {
        useMapEvents({
            click(e) {
                const coords = [e.latlng.lat, e.latlng.lng];
                addMarkerPoint(coords);
            },
            contextmenu(e) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                onTargetClear?.();
            }
        });
        return null;
    };

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

            if (data.theTelMessage?.online) {
                setDroneOnline(true);
            }

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
            if (Date.now() - lastTelTime.current > 5000) {
                setDroneOnline(false);
            }

        }, 500);
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
                altitude: altitude,
                markerPoints: markerPoints

            });
            setVisualCommands(Array.from(combined));
        }, 100); // Your 100ms interval preserved
        return () => clearInterval(interval);
    }, [socket, speed, flightMode, altitude, markerPoints]);

    const ModeSlider = () => {
        const modes = ["ALT_HOLD", "LOITER", "GUIDED"];
        const currentIndex = modes.indexOf(flightMode);

        const getModeColor = () => {
            if (flightMode === "ALT_HOLD") return "bg-orange-500 shadow-orange-500/50";
            if (flightMode === "LOITER") return "bg-purple-500 shadow-purple-500/50";
            return "bg-emerald-500 shadow-emerald-500/50";
        };

        const handleModeChange = (newMode) => {
            // Safety check
            if (!droneOnline) return;
            if (!isGpsLocked && newMode !== "ALT_HOLD") return;

            // Send the command once immediately via socket
            socket.emit("user-message", {
                commands: [],
                flight_mode: newMode,
                altitude: altitude
            });

            // Then update the UI state
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
    const handleTakeoff5m = () => socket?.emit('user-message', { commands: ["fly"]});
    const handleMissionExecute = () => {
        if (!markerPoints.length) {
            console.log("No marker selected. Marker array is empty.");
            return null;
        }
        else{
            socket?.emit('user-message', { commands: ["execute"]});
        }
    }
    return (
        <div>
            {isAutonomous ?
                (
                    <div>
                        {
                            isMobile ? (
                                <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden relative">
                                    {/* --- SHARED HEADER --- */}
                                    <header onPointerDown={(e) => e.preventDefault()} className="w-full py-1 lg:py-3 flex flex-col items-center bg-black/60 backdrop-blur-md border-b border-white/10 z-[110] pointer-events-auto select-none">
                                        <div className="flex flex-row items-center justify-center gap-3 lg:gap-8 w-full px-4">
                                            {targetPos && (
                                                <div className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono leading-tight border-l-2 border-emerald-500/50 pl-2 animate-pulse hidden md:block">
                                                    <p className="text-[6px] lg:text-[8px] uppercase opacity-50 font-black tracking-tighter">Target Lock</p>
                                                    <p className="text-[8px] lg:text-[11px] font-bold">LA: {targetPos[0].toFixed(10)}</p>
                                                    <p className="text-[8px] lg:text-[11px] font-bold">LO: {targetPos[1].toFixed(10)}</p>
                                                </div>
                                            )}

                                            {/* DUAL MODE TOGGLE */}
                                            <div onPointerDown={(e) => e.preventDefault()} className="flex flex-col items-center gap-1 select-none">
                                                <span className={`text-[6px] lg:text-[7px] font-black uppercase tracking-tighter transition-colors ${isAutonomous ? 'text-purple-400' : 'text-emerald-400'}`}>
                                                    {isAutonomous ? 'Autonomous' : 'Manual'}
                                                </span>
                                                <button
                                                    onPointerDown={(e) => e.preventDefault()}
                                                    onClick={() => setIsAutonomous(!isAutonomous)}
                                                    className={`relative w-10 lg:w-12 h-5 lg:h-6 rounded-full border transition-all duration-300 select-none ${isAutonomous ? 'bg-purple-900/30 border-purple-500/50' : 'bg-emerald-900/30 border-emerald-500/50'}`}
                                                >
                                                    <div className={`absolute top-1/2 -translate-y-1/2 size-3 lg:size-4 rounded-full transition-all duration-300 flex items-center justify-center ${isAutonomous ? 'left-[calc(100%-16px)] lg:left-[calc(100%-20px)] bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'left-1 bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}>
                                                        {isAutonomous ? <Rocket size={8} className="text-black" /> : <ShieldAlert size={8} className="text-black" />}
                                                    </div>
                                                </button>
                                            </div>

                                            <div className="flex gap-3 lg:gap-6">
                                                {[{ label: 'R', val: tel?.motors?.[0] }, { label: 'P', val: tel?.motors?.[1] }].map((item, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                        <span className="text-sm lg:text-lg font-mono font-black text-pink-500">{item.val || 1500}</span>
                                                    </div>
                                                ))}
                                            </div>

                                            <h1 className="text-emerald-400 font-black tracking-[0.2em] lg:tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow px-2">Panda Console</h1>

                                            <div className="flex gap-3 lg:gap-6">
                                                {[{ label: 'Y', val: tel?.motors?.[2] }, { label: 'T', val: tel?.motors?.[3] }].map((item, i) => (
                                                    <div key={i} className="flex flex-col items-center">
                                                        <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                        <span className="text-sm lg:text-lg font-mono font-black text-pink-500">{item.val || 1500}</span>
                                                    </div>
                                                ))}
                                            </div>

                                        </div>
                                        <div className="absolute right-4 top-4 size-3 lg:size-4 rounded-full shadow-lg" style={{ backgroundColor: droneOnline ? '#10b981' : '#dc2626' }} />
                                        {missionExecuted && (
                                            <div className="absolute right-16 top-3 z-[120] bg-black/70 border border-emerald-500/30 rounded-full px-2 py-1 text-[8px] sm:text-[10px] uppercase text-emerald-300 font-black">
                                                MISSION EXECUTED
                                            </div>
                                        )}
                                        {/* SATELLITE BAR */}
                                        <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-[10px] lg:text-base uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                                            <Satellite size={isMobile ? 12 : 16} /> {droneOnline ? satCount : 0} Satellites
                                        </div>
                                    </header>



                                    {/* --- LEFT SIDEBAR --- */}
                                    <div className={`absolute left-0 top-20 lg:top-22 bottom-0 z-10 transition-transform duration-500 flex items-center select-none ${isLeftBarOpen ? 'translate-x-0' : '-translate-x-32'}`}>
                                        <div className="w-32 h-[95%] bg-black/1 backdrop-blur-sm border-r border-white/10 rounded-r-3xl p-2">
                                            <p className="text-[6px] text-gray-500 uppercase font-bold tracking-tighter">Mission Params</p>
                                            {/* Empty for now */}
                                        </div>
                                        <button onClick={() => setIsLeftBarOpen(!isLeftBarOpen)} className="bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-r-lg text-emerald-500 ml-[-1px]">
                                            <ArrowRight size={16} className={`transition-transform ${isLeftBarOpen ? 'rotate-180' : ''}`} />
                                        </button>
                                    </div>


                                    {/* --- RIGHT SIDEBAR --- */}
                                    <div className={`absolute right-0 top-20 lg:top-22 bottom-0 z-10 transition-transform duration-500 flex items-center flex-row-reverse select-none ${isRightBarOpen ? 'translate-x-0' : 'translate-x-44'}`}>
                                        <div className="w-44 h-[95%] bg-black/1 backdrop-blur-sm border-l border-white/10 rounded-l-3xl p-2 flex flex-col justify-between">
                                            <div className="flex-1">
                                                <p className="text-[6px] text-gray-500 uppercase font-bold tracking-tighter text-right">Navigation Data</p>
                                            </div>

                                            {/* BOTTOM EXECUTE BAR */}
                                            <div className="flex flex-col gap-1 pb-2">
                                                <div className="flex items-center gap-2">
                                                    <div className="flex-1 bg-black/30 border border-emerald-500/30 rounded-lg px-1.5 py-0.5 sm:px-1 sm:py-0.5">
                                                        <input
                                                            type="text"
                                                            placeholder="lat, lon"
                                                            className={`w-full bg-transparent border-none text-[8px] sm:text-[9px] font-mono focus:ring-0 outline-none ${isDarkMode ? 'text-emerald-400 placeholder:text-emerald-400' : 'text-black placeholder:text-slate-600'}`}
                                                            value={coordInput}
                                                            onChange={(e) => setCoordInput(e.target.value)}
                                                        />
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            const coords = coordInput.split(',').map(c => parseFloat(c.trim()));
                                                            if (coords.length === 2 && !isNaN(coords[0])) {
                                                                const parsed = [coords[0], coords[1]];
                                                                addMarkerPoint(parsed);
                                                                setCoordInput("");
                                                            }
                                                        }}
                                                        className="bg-emerald-600 text-black font-black text-[7px] sm:text-[9px] px-2 py-1 rounded-lg active:scale-95 transition-all"
                                                    >
                                                        Confirm
                                                    </button>
                                                </div>
                                                <button
                                                    onClick={() => {
                                                        if (!markerPoints.length) return;
                                                        handleMissionExecute();
                                                        setMissionExecuted(true);
                                                        setTimeout(() => setMissionExecuted(false), 5000);
                                                    }}
                                                    disabled={!markerPoints.length}
                                                    className={`w-full text-black font-black text-[7px] sm:text-[9px] py-1 rounded-lg active:scale-95 transition-all ${markerPoints.length ? 'bg-purple-600' : 'bg-slate-400 cursor-not-allowed'}`}
                                                >
                                                    EXECUTE
                                                </button>
                                            </div>
                                        </div>
                                        <button onClick={() => setIsRightBarOpen(!isRightBarOpen)} className="bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-l-lg text-emerald-500 mr-[-1px]">
                                            <ArrowRight size={16} className={`transition-transform ${isRightBarOpen ? '' : 'rotate-180'}`} />
                                        </button>
                                    </div>

                                    {/* Arm land slide bar */}
                                    {/* Velocit Limit slide bar */}
                                    <div className="absolute left-1/2 bottom-2 z-[20] -translate-x-1/2 pointer-events-auto select-none w-full max-w-lg px-2">
                                        <div className="mx-auto flex w-full items-center justify-center gap-2">
                                            <div className="flex-none w-[160px] select-none mt-12">
                                                <div className="flex flex-col gap-0.5 w-full justify-end items-center">
                                                    <div className="flex justify-between w-full px-1 mb-0.5">
                                                        <span className="text-[6px] lg:text-[8px] text-orange-400 font-black uppercase tracking-tight">Velocity Limit</span>
                                                        <span className="text-[8px] lg:text-[10px] text-orange-400 font-mono font-bold">{speed}%</span>
                                                    </div>
                                                    <div className="relative w-full h-5 lg:h-6 bg-black/60 border border-orange-500/30 rounded-full p-0.5 overflow-hidden shadow-2xl flex items-center">
                                                        <input
                                                            type="range"
                                                            min="0"
                                                            max="100"
                                                            step="5"
                                                            value={speed}
                                                            onChange={(e) => setSpeed(parseInt(e.target.value))}
                                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
                                                            style={{ WebkitAppearance: 'none', appearance: 'none', width: '100%', height: '100%' }}
                                                        />
                                                        <div
                                                            className="h-full bg-gradient-to-r from-orange-700 to-orange-400 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                                                            style={{ width: `${speed}%` }}
                                                        />
                                                    </div>
                                                    <p className="text-[6px] lg:text-[7px] text-orange-500 uppercase font-black mt-1">Sensitivity Control</p>
                                                </div>
                                            </div>

                                            <div className="relative w-6 lg:w-6 h-24 lg:h-32 ml-2 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl overflow-visible">
                                                <div ref={sliderRef} style={{ touchAction: 'none', userSelect: 'none' }}
                                                    onPointerDown={(e) => {
                                                        e.preventDefault();
                                                        e.currentTarget.setPointerCapture(e.pointerId);
                                                        setIsDraggingSlider(true);
                                                        hasTriggeredAction.current = false;
                                                    }}
                                                    onPointerMove={(e) => {
                                                        if (!isDraggingSlider || !sliderRef.current) return;
                                                        const rect = sliderRef.current.getBoundingClientRect();
                                                        const clientY = e.nativeEvent.clientY || e.clientY;
                                                        let dy = clientY - (rect.top + rect.height / 2);
                                                        const maxRange = rect.height / 2 - 10;
                                                        dy = Math.max(-maxRange, Math.min(maxRange, dy));
                                                        setYPos(dy);
                                                        const threshold = maxRange * 0.7;
                                                        if (!hasTriggeredAction.current) {
                                                            if (dy <= -threshold) {
                                                                activeKeys.current.add("arm");
                                                                if (navigator.vibrate) navigator.vibrate(50);
                                                                hasTriggeredAction.current = true;
                                                                setTimeout(() => activeKeys.current.delete("arm"), 500);
                                                            } else if (dy >= threshold) {
                                                                activeKeys.current.delete("arm");
                                                                activeKeys.current.add("land");
                                                                if (navigator.vibrate) navigator.vibrate(50);
                                                                hasTriggeredAction.current = true;
                                                                setTimeout(() => {
                                                                    activeKeys.current.delete("land");
                                                                    hasTriggeredAction.current = false;
                                                                }, 500);
                                                            }
                                                        }
                                                    }}
                                                    onPointerUp={() => {
                                                        setIsDraggingSlider(false);
                                                        setYPos(0);
                                                        hasTriggeredAction.current = false;
                                                    }}
                                                    onPointerCancel={() => {
                                                        setIsDraggingSlider(false);
                                                        setYPos(0);
                                                        hasTriggeredAction.current = false;
                                                    }}
                                                    className="relative w-full h-full flex items-center justify-center select-none"
                                                >
                                                    <div className="absolute top-2 text-[5px] lg:text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                                                    <div className="absolute bottom-2 text-[5px] lg:text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                                                    <div className="w-full h-0.5 bg-white/10 absolute" />
                                                    <div
                                                        className={`absolute w-5 h-5 lg:w-12 lg:h-12 flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse
                            ${(isArmedFromTel || yPos < -20)
                                                                ? "bg-emerald-500 rounded-md shadow-[0_0_20px_#10b981]"
                                                                : (yPos > 20)
                                                                    ? "bg-orange-500 rounded-full shadow-[0_0_20px_#f97316]"
                                                                    : "bg-purple-600 shadow-[0_0_20px_#9333ea]"
                                                            }`}
                                                        style={{
                                                            transform: `translateY(${yPos}px)`,
                                                            clipPath: (isArmedFromTel || yPos < -20 || yPos > 20)
                                                                ? "none"
                                                                : "polygon(50% 0%, 0% 100%, 100% 100%)"
                                                        }}
                                                    >
                                                        {(isArmedFromTel || yPos < -20) ? <Power size={8} className="text-black" /> :
                                                            (yPos > 20) ? <ArrowDownToLine size={8} className="text-black" /> :
                                                                <Circle size={6} className="text-white mt-1" fill="white" />}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* --- MAIN CONTENT AREA --- */}
                                    <div className="flex-1 relative overflow-hidden">

                                        {/* IF AUTONOMOUS: FULL SCREEN MAP */}
                                        {isAutonomous ? (
                                            <div className="absolute inset-0 z-0">
                                                <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
                                                    <button
                                                        onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }}
                                                        className="flex items-center gap-2 px-4 py-2 bg-black/60 border border-white/20 rounded-full text-emerald-300 hover:bg-black/80 transition pointer-events-auto"
                                                    >
                                                        {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                                                        <span className="text-[10px] uppercase tracking-[0.24em] font-black">
                                                            {isDarkMode ? 'Light' : 'Dark'} Mode
                                                        </span>
                                                    </button>
                                                </div>
                                                {targetPos && (
                                                    <div style={{ position: 'absolute', top: '4rem', right: isRightBarOpen ? '12rem' : '3rem', zIndex: 1000 }} className="pointer-events-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); handleClearTarget(); }}
                                                            className={`flex items-center gap-1 px-1 py-1 rounded-full transition ${isDarkMode ? 'bg-white/10 border border-white/60 text-white hover:bg-white/20' : 'bg-black border border-black/70 text-white hover:bg-black/80'}`}
                                                        >
                                                            <X size={10} />
                                                            <span className="text-[6px]  tracking-[0.24em] font-black">Clear</span>

                                                        </button>
                                                    </div>
                                                )}
                                                <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                                                    <TileLayer url={mapTiles} />
                                                    <MapClickHandler onTargetClear={handleClearTarget} />
                                                    <Marker position={position} key={`drone-auto-${lat}-${lon}`} />
                                                    {targetPos && (
                                                        <>
                                                            <Marker position={targetPos} icon={createColoredIcon(targetColor)} />
                                                            <Polyline positions={[position, targetPos]} color={targetColor} weight={2} dashArray="5, 10" />
                                                        </>
                                                    )}
                                                    <RecenterMap coords={position} />
                                                </MapContainer>
                                            </div>
                                        ) : (
                                            /* --- ORIGINAL MANUAL MODE FPV + HUD CODE --- */
                                            <>
                                                {/* Your existing FPV placeholder, Joysticks, and small Map code here */}
                                            </>
                                        )}
                                    </div>
                                </div>
                            ) :
                                (
                                    <div className="h-[100dvh] w-full bg-black flex flex-col overflow-hidden relative">
                                        {/* --- SHARED HEADER --- */}
                                        <header onPointerDown={(e) => e.preventDefault()} className="w-full py-1 lg:py-3 flex flex-col items-center bg-black/60 backdrop-blur-md border-b border-white/10 z-[110] pointer-events-auto select-none">
                                            <div className="flex flex-row items-center justify-center gap-3 lg:gap-8 w-full px-4">
                                                {targetPos && (
                                                    <div className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono leading-tight border-l-2 border-emerald-500/50 pl-2 animate-pulse hidden md:block">
                                                        <p className="text-[6px] lg:text-[8px] uppercase opacity-50 font-black tracking-tighter">Target Lock</p>
                                                        <p className="text-[8px] lg:text-[11px] font-bold">LA: {targetPos[0].toFixed(10)}</p>
                                                        <p className="text-[8px] lg:text-[11px] font-bold">LO: {targetPos[1].toFixed(10)}</p>
                                                    </div>
                                                )}

                                                {/* DUAL MODE TOGGLE */}
                                                <div onPointerDown={(e) => e.preventDefault()} className="flex flex-col items-center gap-1 select-none">
                                                    <span className={`text-[6px] lg:text-[7px] font-black uppercase tracking-tighter transition-colors ${isAutonomous ? 'text-purple-400' : 'text-emerald-400'}`}>
                                                        {isAutonomous ? 'Autonomous' : 'Manual'}
                                                    </span>
                                                    <button
                                                        onPointerDown={(e) => e.preventDefault()}
                                                        onClick={() => setIsAutonomous(!isAutonomous)}
                                                        className={`relative w-10 lg:w-12 h-5 lg:h-6 rounded-full border transition-all duration-300 select-none ${isAutonomous ? 'bg-purple-900/30 border-purple-500/50' : 'bg-emerald-900/30 border-emerald-500/50'}`}
                                                    >
                                                        <div className={`absolute top-1/2 -translate-y-1/2 size-3 lg:size-4 rounded-full transition-all duration-300 flex items-center justify-center ${isAutonomous ? 'left-[calc(100%-16px)] lg:left-[calc(100%-20px)] bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'left-1 bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}>
                                                            {isAutonomous ? <Rocket size={8} className="text-black" /> : <ShieldAlert size={8} className="text-black" />}
                                                        </div>
                                                    </button>
                                                </div>

                                                <div className="flex gap-3 lg:gap-6">
                                                    {[{ label: 'R', val: tel?.motors?.[0] }, { label: 'P', val: tel?.motors?.[1] }].map((item, i) => (
                                                        <div key={i} className="flex flex-col items-center">
                                                            <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                            <span className="text-sm lg:text-lg font-mono font-black text-pink-500">{item.val || 1500}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                                <h1 className="text-emerald-400 font-black tracking-[0.2em] lg:tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow px-2">Panda Console</h1>

                                                <div className="flex gap-3 lg:gap-6">
                                                    {[{ label: 'Y', val: tel?.motors?.[2] }, { label: 'T', val: tel?.motors?.[3] }].map((item, i) => (
                                                        <div key={i} className="flex flex-col items-center">
                                                            <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                            <span className="text-sm lg:text-lg font-mono font-black text-pink-500">{item.val || 1500}</span>
                                                        </div>
                                                    ))}
                                                </div>

                                            </div>
                                            <div className="absolute right-4 top-4 size-3 lg:size-4 rounded-full shadow-lg" style={{ backgroundColor: droneOnline ? '#10b981' : '#dc2626' }} />
                                            {missionExecuted && (
                                                <div className="absolute right-16 top-3 z-[120] bg-black/70 border border-emerald-500/30 rounded-full px-2 py-1 text-[8px] sm:text-[10px] uppercase text-emerald-300 font-black">
                                                    MISSION EXECUTED
                                                </div>
                                            )}
                                            {/* SATELLITE BAR */}
                                            <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-[10px] lg:text-base uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                                                <Satellite size={isMobile ? 12 : 16} /> {droneOnline ? satCount : 0} Satellites
                                            </div>
                                        </header>



                                        {/* --- LEFT SIDEBAR --- */}
                                        <div className={`absolute left-0 top-20 lg:top-22 bottom-0 z-10 transition-transform duration-500 flex items-center select-none ${isLeftBarOpen ? 'translate-x-0' : '-translate-x-32'}`}>
                                            <div className="w-60 h-[95%] bg-black/1 backdrop-blur-sm border-r border-white/10 rounded-r-3xl p-2">
                                                <p className="text-[12px] text-gray-500 uppercase font-bold tracking-tighter">Mission Params</p>
                                                {/* Empty for now */}
                                            </div>
                                            <button onClick={() => setIsLeftBarOpen(!isLeftBarOpen)} className="bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-r-lg text-emerald-500 ml-[-1px]">
                                                <ArrowRight size={16} className={`transition-transform ${isLeftBarOpen ? 'rotate-180' : ''}`} />
                                            </button>
                                        </div>


                                        {/* --- RIGHT SIDEBAR --- */}
                                        <div className={`absolute right-0 top-20 lg:top-22 bottom-0 z-10 transition-transform duration-500 flex items-center flex-row-reverse select-none ${isRightBarOpen ? 'translate-x-0' : 'translate-x-44'}`}>
                                            <div className="w-75 h-[95%] bg-black/1 backdrop-blur-sm border-l border-white/10 rounded-l-3xl p-2 flex flex-col justify-between">
                                                <div className="flex-1">
                                                    <p className="text-[10px] text-gray-500 uppercase font-bold tracking-tighter text-right">Navigation Data</p>
                                                </div>

                                                {/* BOTTOM EXECUTE BAR */}
                                                <div className="flex flex-col gap-1 pb-2">
                                                    <div className="flex items-center gap-2">
                                                        <div className="flex-1 bg-black/30 border border-emerald-500/30 rounded-lg px-1.5 py-0.5 sm:px-1 sm:py-0.5">
                                                            <input
                                                                type="text"
                                                                placeholder="lat, lon"
                                                                className={`w-full bg-transparent border-none text-[8px] sm:text-[9px] font-mono focus:ring-0 outline-none ${isDarkMode ? 'text-emerald-400 placeholder:text-emerald-400' : 'text-black placeholder:text-slate-600'}`}
                                                                value={coordInput}
                                                                onChange={(e) => setCoordInput(e.target.value)}
                                                            />
                                                        </div>
                                                        <button
                                                            onClick={() => {
                                                                const coords = coordInput.split(',').map(c => parseFloat(c.trim()));
                                                                if (coords.length === 2 && !isNaN(coords[0])) {
                                                                    const parsed = [coords[0], coords[1]];
                                                                    addMarkerPoint(parsed);
                                                                    setCoordInput("");
                                                                }
                                                            }}
                                                            className="bg-emerald-600 text-black font-black text-[7px] sm:text-[12px] px-3 py-2 rounded-lg active:scale-95 transition-all"
                                                        >
                                                            Confirm
                                                        </button>
                                                    </div>
                                                    <button
                                                        onClick={() => {
                                                            if (!markerPoints.length) return;
                                                            handleMissionExecute();
                                                            setMissionExecuted(true);
                                                            setTimeout(() => setMissionExecuted(false), 5000);
                                                        }}
                                                        disabled={!markerPoints.length}
                                                        className={`w-full text-black font-black text-[12px] sm:text-[12] py-2 rounded-lg active:scale-95 transition-all ${markerPoints.length ? 'bg-purple-600' : 'bg-slate-400 cursor-not-allowed'}`}
                                                    >
                                                        EXECUTE
                                                    </button>
                                                </div>
                                            </div>
                                            <button onClick={() => setIsRightBarOpen(!isRightBarOpen)} className="bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-l-lg text-emerald-500 mr-[-1px]">
                                                <ArrowRight size={16} className={`transition-transform ${isRightBarOpen ? '' : 'rotate-180'}`} />
                                            </button>
                                        </div>

                                        {/* Arm land slide bar */}
                                        {/* Velocit Limit slide bar */}
                                        <div className="absolute left-1/2 bottom-2 z-[20] -translate-x-1/2 pointer-events-auto select-none w-full max-w-lg px-2">
                                            <div className="mx-auto flex w-full items-center justify-center gap-2">
                                                <div className="flex-none w-[300px] h-[100px] select-none mt-12">
                                                    <div className="flex flex-col gap-0.5 w-full justify-end items-center">
                                                        <div className="flex justify-between w-full px-1 mb-0.5">
                                                            <span className="text-[6px] lg:text-[10px] text-orange-400 font-black uppercase tracking-tight">Velocity Limit</span>
                                                            <span className="text-[8px] lg:text-[12px] text-orange-400 font-mono font-bold">{speed}%</span>
                                                        </div>
                                                        <div className="relative w-full lg:h-8 bg-black/60 border border-orange-500/30 rounded-full p-0.5 overflow-hidden shadow-2xl flex items-center">
                                                            <input
                                                                type="range"
                                                                min="0"
                                                                max="100"
                                                                step="5"
                                                                value={speed}
                                                                onChange={(e) => setSpeed(parseInt(e.target.value))}
                                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10"
                                                                style={{ WebkitAppearance: 'none', appearance: 'none', width: '100%', height: '100%' }}
                                                            />
                                                            <div
                                                                className="h-full bg-gradient-to-r from-orange-700 to-orange-400 rounded-full transition-all duration-300 shadow-[0_0_15px_rgba(249,115,22,0.4)]"
                                                                style={{ width: `${speed}%` }}
                                                            />
                                                        </div>
                                                        <p className="text-[9px] lg:text-10px] text-orange-500 uppercase font-black mt-1">Sensitivity Control</p>
                                                    </div>
                                                </div>

                                                <div className="relative w-6 lg:w-11 h-2 lg:h-50 ml-10 mb-4 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl overflow-visible">
                                                    <div ref={sliderRef} style={{ touchAction: 'none', userSelect: 'none' }}
                                                        onPointerDown={(e) => {
                                                            e.preventDefault();
                                                            e.currentTarget.setPointerCapture(e.pointerId);
                                                            setIsDraggingSlider(true);
                                                            hasTriggeredAction.current = false;
                                                        }}
                                                        onPointerMove={(e) => {
                                                            if (!isDraggingSlider || !sliderRef.current) return;
                                                            const rect = sliderRef.current.getBoundingClientRect();
                                                            const clientY = e.nativeEvent.clientY || e.clientY;
                                                            let dy = clientY - (rect.top + rect.height / 2);
                                                            const maxRange = rect.height / 2 - 10;
                                                            dy = Math.max(-maxRange, Math.min(maxRange, dy));
                                                            setYPos(dy);
                                                            const threshold = maxRange * 0.7;
                                                            if (!hasTriggeredAction.current) {
                                                                if (dy <= -threshold) {
                                                                    activeKeys.current.add("arm");
                                                                    if (navigator.vibrate) navigator.vibrate(50);
                                                                    hasTriggeredAction.current = true;
                                                                    setTimeout(() => activeKeys.current.delete("arm"), 500);
                                                                } else if (dy >= threshold) {
                                                                    activeKeys.current.delete("arm");
                                                                    activeKeys.current.add("land");
                                                                    if (navigator.vibrate) navigator.vibrate(50);
                                                                    hasTriggeredAction.current = true;
                                                                    setTimeout(() => {
                                                                        activeKeys.current.delete("land");
                                                                        hasTriggeredAction.current = false;
                                                                    }, 500);
                                                                }
                                                            }
                                                        }}
                                                        onPointerUp={() => {
                                                            setIsDraggingSlider(false);
                                                            setYPos(0);
                                                            hasTriggeredAction.current = false;
                                                        }}
                                                        onPointerCancel={() => {
                                                            setIsDraggingSlider(false);
                                                            setYPos(0);
                                                            hasTriggeredAction.current = false;
                                                        }}
                                                        className="relative w-full h-full flex items-center justify-center select-none"
                                                    >
                                                        <div className="absolute top-2 text-[5px] lg:text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                                                        <div className="absolute bottom-2 text-[5px] lg:text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                                                        <div className="w-full h-0.5 bg-white/10 absolute" />
                                                        <div
                                                            className={`absolute w-5 h-5 lg:w-10 lg:h-10 flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse
                            ${(isArmedFromTel || yPos < -20)
                                                                    ? "bg-emerald-500 rounded-md shadow-[0_0_20px_#10b981]"
                                                                    : (yPos > 20)
                                                                        ? "bg-orange-500 rounded-full shadow-[0_0_20px_#f97316]"
                                                                        : "bg-purple-600 shadow-[0_0_20px_#9333ea]"
                                                                }`}
                                                            style={{
                                                                transform: `translateY(${yPos}px)`,
                                                                clipPath: (isArmedFromTel || yPos < -20 || yPos > 20)
                                                                    ? "none"
                                                                    : "polygon(50% 0%, 0% 100%, 100% 100%)"
                                                            }}
                                                        >
                                                            {(isArmedFromTel || yPos < -20) ? <Power size={10} className="text-black" /> :
                                                                (yPos > 20) ? <ArrowDownToLine size={12} className="text-black" /> :
                                                                    <Circle size={10} className="text-white mt-1" fill="white" />}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* --- MAIN CONTENT AREA --- */}
                                        <div className="flex-1 relative overflow-hidden">

                                            {/* IF AUTONOMOUS: FULL SCREEN MAP */}
                                            {isAutonomous ? (
                                                <div className="absolute inset-0 z-0">
                                                    <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto">
                                                        <button
                                                            onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }}
                                                            className="flex items-center gap-2 px-4 py-2 bg-black/60 border border-white/20 rounded-full text-emerald-300 hover:bg-black/80 transition pointer-events-auto"
                                                        >
                                                            {isDarkMode ? <Sun size={16} /> : <Moon size={16} />}
                                                            <span className="text-[10px] uppercase tracking-[0.24em] font-black">
                                                                {isDarkMode ? 'Light' : 'Dark'} Mode
                                                            </span>
                                                        </button>
                                                    </div>
                                                    {targetPos && (
                                                        <div style={{ position: 'absolute', top: '4rem', right: isRightBarOpen ? '20rem' : '9em', zIndex: 1000 }} className="pointer-events-auto">
                                                            <button
                                                                onClick={(e) => { e.stopPropagation(); handleClearTarget(); }}
                                                                className={`flex items-center gap-1 px-2 py-2 rounded-full transition-transform ${isDarkMode ? 'bg-white/10 border border-white/60 text-white hover:bg-white/20' : 'bg-black border border-black/70 text-white hover:bg-black/80'}`}
                                                            >
                                                                <X size={10} />
                                                                <span className="text-[12px]  tracking-[0.24em] font-black">Clear Marker</span>

                                                            </button>
                                                        </div>
                                                    )}
                                                    <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                                                        <TileLayer url={mapTiles} />
                                                        <MapClickHandler onTargetClear={handleClearTarget} />
                                                        <Marker position={position} key={`drone-auto-${lat}-${lon}`} />
                                                        {targetPos && (
                                                            <>
                                                                <Marker position={targetPos} icon={createColoredIcon(targetColor)} />
                                                                <Polyline positions={[position, targetPos]} color={targetColor} weight={2} dashArray="5, 10" />
                                                            </>
                                                        )}
                                                        <RecenterMap coords={position} />
                                                    </MapContainer>
                                                </div>
                                            ) : (
                                                /* --- ORIGINAL MANUAL MODE FPV + HUD CODE --- */
                                                <>
                                                    {/* Your existing FPV placeholder, Joysticks, and small Map code here */}
                                                </>
                                            )}
                                        </div>
                                    </div>
                                )
                        }
                    </div>
                )


                : (

                    < div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative" style={{ touchAction: 'none' }}>

                        {/* --- MOBILE ENTRY OVERLAY (Button triggers Swipe Exit) --- */}
                        {
                            isMobile && (
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
                            )
                        }

                        {/* LAYER 0: FPV BACKGROUND */}
                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                            {/* ... Radar Rings ... */}

                            {/* CHANGE: Changed mt-32 to absolute positioning */}
                            <div className="absolute top-[40%] left-1/2 -translate-x-1/2 text-center z-20 w-full">
                                <p className="text-emerald-400 font-mono text-[10px] lg:text-xs tracking-[0.3em] uppercase animate-pulse">
                                    {droneOnline ? "Receiving Data Stream" : "Searching for Drone"}
                                </p>
                                {!droneOnline && (
                                    <div className="flex justify-center gap-1 mt-1">
                                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                        <span className="size-1 bg-emerald-500 rounded-full animate-bounce" />
                                    </div>
                                )}
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
                            {/* BATTERY HUD */}
                            <div className="flex items-center gap-2 mt-2 pt-1 border-t border-white/5">
                                <div className={`px-2 py-0.5 rounded text-[10px] font-black tracking-tighter ${(tel?.battery?.p || 0) < 20 ? 'bg-red-500 animate-pulse text-white' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                    }`}>
                                    {tel?.battery?.p || 0}%
                                </div>
                                <div className="flex flex-col leading-none">
                                    <span className="text-[7px] opacity-40 uppercase font-bold">Voltage</span>
                                    <span className="text-[10px] font-mono font-bold text-blue-400">
                                        {tel?.battery?.v?.toFixed(1) || "0.0"}V
                                    </span>
                                </div>
                            </div>



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


                        <div className="absolute inset-0 z-10 flex flex-col pointer-events-auto">

                            <header onPointerDown={(e) => e.preventDefault()} className="w-full py-1 lg:py-3 flex flex-col items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto select-none">
                                {/* TARGET COORDINATES DISPLAY */}
                                <div className="flex flex-row items-center justify-center gap-3 lg:gap-8 w-full px-4">
                                    {targetPos && (
                                        <div className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono leading-tight border-l-2 border-emerald-500/50 pl-2 animate-pulse">
                                            <p className="text-[6px] lg:text-[8px] uppercase opacity-50 font-black tracking-tighter">Target Lock</p>
                                            <p className="text-[8px] lg:text-[11px] font-bold">LA: {targetPos[0].toFixed(10)}</p>
                                            <p className="text-[8px] lg:text-[11px] font-bold">LO: {targetPos[1].toFixed(10)}</p>
                                        </div>
                                    )}

                                    {/* --- DUAL MODE TOGGLE SWITCH --- */}
                                    <div className="flex flex-col items-center gap-1">
                                        <span className={`text-[6px] lg:text-[7px] font-black uppercase tracking-tighter transition-colors ${isAutonomous ? 'text-purple-400' : 'text-emerald-400'}`}>
                                            {isAutonomous ? 'Autonomous' : 'Manual'}
                                        </span>

                                        <button
                                            onClick={() => setIsAutonomous(!isAutonomous)}
                                            className={`relative w-10 lg:w-12 h-5 lg:h-6 rounded-full border transition-all duration-300 ${isAutonomous ? 'bg-purple-900/30 border-purple-500/50' : 'bg-emerald-900/30 border-emerald-500/50'
                                                }`}
                                        >
                                            {/* Switch Handle */}
                                            <div className={`absolute top-1/2 -translate-y-1/2 size-3 lg:size-4 rounded-full transition-all duration-300 flex items-center justify-center ${isAutonomous ? 'left-[calc(100%-16px)] lg:left-[calc(100%-20px)] bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'left-1 bg-emerald-500 shadow-[0_0_10px_#10b981]'
                                                }`}>
                                                {isAutonomous ? <Rocket size={8} className="text-black" /> : <ShieldAlert size={8} className="text-black" />}
                                            </div>
                                        </button>
                                    </div>

                                    {/* LEFT SIDE: ROLL & PITCH */}
                                    <div className="flex gap-3 lg:gap-6">
                                        {[
                                            { label: 'R', val: tel?.motors?.[0] },
                                            { label: 'P', val: tel?.motors?.[1] }
                                        ].map((item, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                <span className="text-sm lg:text-lg font-mono font-black text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.3)]">
                                                    {item.val || 1500}
                                                </span>
                                            </div>
                                        ))}
                                    </div>

                                    {/* CENTER TITLE */}
                                    <h1 className="text-emerald-400 font-black tracking-[0.2em] lg:tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow px-2">
                                        Panda Console
                                    </h1>

                                    {/* RIGHT SIDE: YAW & THROTTLE */}
                                    <div className="flex gap-3 lg:gap-6">
                                        {[
                                            { label: 'Y', val: tel?.motors?.[2] },
                                            { label: 'T', val: tel?.motors?.[3] }
                                        ].map((item, i) => (
                                            <div key={i} className="flex flex-col items-center">
                                                <span className="text-[7px] lg:text-[9px] text-gray-400 font-bold uppercase">{item.label}</span>
                                                <span className="text-sm lg:text-lg font-mono font-black text-pink-500 drop-shadow-[0_0_5px_rgba(236,72,153,0.3)]">
                                                    {item.val || (item.label === 'T' ? 1000 : 1500)}
                                                </span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* SATELLITE BAR */}
                                <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-[10px] lg:text-base uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                                    <Satellite size={isMobile ? 12 : 16} /> {droneOnline ? satCount : 0} Satellites
                                </div>

                                {/* STATUS LIGHT */}
                                <div className="absolute right-4 top-4 size-3 lg:size-4 rounded-full shadow-lg transition-all duration-500"
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

                            <main className="flex-1 w-full flex flex-col md:flex-row items-end md:items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12 gap-4 md:gap-0">

                                {/* LEFT SECTION (JOYSTICK + TAKEOFF) */}
                                <div className="w-full md:flex-1 flex items-center justify-center md:justify-start gap-6 md:gap-12 lg:gap-20 pointer-events-auto">
                                    <div className="flex flex-col items-center ml-0 md:ml-4 mb-2 md:mb-2 lg:ml-10 lg:mb-6 w-full md:w-auto">
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
                                        className="size-12 lg:size-22  rounded-full bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 flex flex-col items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.5)] active:scale-90 transition-all hover:bg-emerald-500 hover:text-black group"
                                    >
                                        <Rocket className="size-5 lg:size-8 group-hover:animate-bounce" />
                                        <span className="text-[6.5px] lg:text-[15px] font-black leading-none mt-1 text-center">Fly</span>
                                    </button>

                                </div>

                                {/* CENTER HUD & SLIDER */}
                                <div className="flex-none w-full md:w-auto flex flex-row items-end justify-center gap-2 lg:gap-10 mb-2 pointer-events-auto">
                                    <div className="flex flex-col gap-1 w-full md:w-50 lg:w-80 justify-end items-center">
                                        <div className='flex flex-col items-center w-full px-2 mb-1 pointer-events-auto'>
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
                                                    // FIX: Clear the "arm" command if we are trying to land to prevent a conflict
                                                    activeKeys.current.delete("arm");
                                                    activeKeys.current.add("land");

                                                    if (navigator.vibrate) navigator.vibrate(50);
                                                    hasTriggeredAction.current = true;

                                                    // IMPORTANT: Clear the land command quickly so Python doesn't get stuck in a loop
                                                    setTimeout(() => {
                                                        activeKeys.current.delete("land");
                                                        hasTriggeredAction.current = false; // Reset lock so you can swipe again
                                                    }, 500);
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
                                        className="relative w-16 md:w-10 lg:w-14 h-24 md:h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl overflow-visible"
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

                                {/* RIGHT SECTION (JOYSTICK + TAKEOFF) */}
                                <div className="w-full md:flex-1 flex justify-center md:justify-end pr-0 md:pr-8 lg:pr-0 pointer-events-auto">
                                    <div className="flex flex-col items-center mr-4 mb-2 lg:mr-10 lg:mb-6">
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
                            className={`transition-all duration-500 z-[100] border-2 border-emerald-500/30 overflow-hidden ${isMapExpanded
                                ? 'absolute top-0 right-0 w-1/2 h-screen border-l bg-black shadow-[-20px_0_30px_rgba(0,0,0,0.5)]'
                                : 'absolute top-4 right-10 w-25 h-25 lg:w-28 lg:h-28 rounded-2xl shadow-xl cursor-pointer hover:border-emerald-400'
                                }`}>

                            <div className="absolute top-3 left-3 flex flex-col gap-2 z-[1001]">
                                <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-emerald-400">
                                    {isDarkMode ? <Sun size={14} /> : <Moon size={14} />}
                                </button>
                            </div>

                            {isMapExpanded && (
                                <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="absolute top-3 right-3 z-[1001] bg-red-600 p-2 rounded-lg text-white shadow-lg pointer-events-auto">
                                    <X size={20} />
                                </button>
                            )}

                            <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                                <TileLayer url={mapTiles} />

                                {/* Helper to catch clicks */}
                                {isMapExpanded && <MapClickHandler />}

                                {/* 1. The Drone Marker (Default Blue/Icon) */}
                                <Marker position={position} key={`drone-${lat}-${lon}`} />

                                {/* 2. The Target Marker and Line */}
                                {targetPos && (
                                    <>
                                        <Marker position={targetPos} icon={createColoredIcon(targetColor)} />
                                        <Polyline
                                            positions={[position, targetPos]}
                                            color={targetColor}
                                            weight={2}
                                            dashArray="5, 10"
                                            opacity={0.8}
                                        />
                                    </>
                                )}

                                <RecenterMap coords={position} />
                                <MapResizer isExpanded={isMapExpanded} />
                            </MapContainer>

                            {/* 3. THE EXECUTE BAR - Only visible when map is expanded */}
                            {isMapExpanded && (
                                <div onClick={(e) => e.stopPropagation()} className="absolute bottom-4 left-4 right-4 z-[1001] flex flex-col sm:flex-row gap-2">
                                    <div className="flex-1 bg-black/80 backdrop-blur-md border border-emerald-500/30 rounded-xl flex items-center px-3 py-2 sm:px-4 sm:py-3">
                                        <input
                                            type="text"
                                            placeholder="lon, lat"
                                            className={`w-full bg-transparent border-none text-[9px] sm:text-[10px] font-mono py-2 sm:py-3 focus:ring-0 outline-none ${isDarkMode ? 'text-emerald-400 placeholder:text-emerald-400' : 'text-black placeholder:text-slate-600'}`}
                                            value={coordInput}
                                            onChange={(e) => setCoordInput(e.target.value)}
                                        />
                                    </div>
                                    <button
                                        onClick={() => {
                                            if (!markerPoints.length) return;
                                            handleMissionExecute();
                                            setMissionExecuted(true);
                                            setTimeout(() => setMissionExecuted(false), 5000);
                                        }}
                                        disabled={!markerPoints.length}
                                        className={`font-black text-[9px] sm:text-[10px] px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl transition ${markerPoints.length ? 'bg-emerald-600 text-black' : 'bg-slate-400 text-slate-700 cursor-not-allowed'}`}
                                    >
                                        EXECUTE
                                    </button>
                                </div>
                            )}
                        </div>


                        <style dangerouslySetInnerHTML={{
                            __html: `
                .green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } 
                .vertical-text { writing-mode: vertical-rl; }
                input[type=range] { writing-mode: bt-lr; -webkit-appearance: slider-vertical; }
                * { -webkit-tap-highlight-color: transparent !important; }
            ` }} />

                    </div >
                )
            }
        </div >
    );
};