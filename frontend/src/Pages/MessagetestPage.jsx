import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    Power, Circle, ShieldAlert, ExternalLink, X, Maximize2, Rocket, Signal, Sun, Moon, Satellite, User, ArrowRight, ArrowDownToLine
} from "lucide-react";
import { MapContainer, TileLayer, Marker, useMap, useMapEvents, Polyline } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useNavigate } from 'react-router-dom';



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
    const { socket, authUser } = useAuthState();

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
    const [flightMode, setFlightMode] = useState("ALT_HOLD");
    const [hasInitialGpsAutoSwitch, setHasInitialGpsAutoSwitch] = useState(false);
    const [speed, setSpeed] = useState(20);
    const [droneOnline, setDroneOnline] = useState(false);
    const [missionExecuted, setMissionExecuted] = useState(false);
    const lastTelTime = useRef(Date.now());
    const [mavLogs, setMavLogs] = useState([]);
    const [isTerminalOpen, setIsTerminalOpen] = useState(false);
    const [targetPos, setTargetPos] = useState(null);
    const [targetColor, setTargetColor] = useState('#10b981');
    const [markerPoints, setMarkerPoints] = useState([]);
    const [coordInput, setCoordInput] = useState("");
    const [isAutonomous, setIsAutonomous] = useState(false);
    const [isLeftBarOpen, setIsLeftBarOpen] = useState(true);
    const [isRightBarOpen, setIsRightBarOpen] = useState(true);

    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());
    const [yPos, setYPos] = useState(0);
    const lastEmitTime = useRef(Date.now());
    const logEndRef = useRef(null);

    const navigate = useNavigate();

    const handleClearTarget = useCallback(() => {
        setTargetPos(null);
        setMarkerPoints([]);
    }, []);

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
        className: "", iconSize: [25, 41], iconAnchor: [12, 41]
    });

    const MapClickHandler = ({ onTargetClear }) => {
        useMapEvents({
            click(e) {
                if (!isAutonomous && !isMapExpanded) return;
                addMarkerPoint([e.latlng.lat, e.latlng.lng]);
            },
            contextmenu(e) {
                e.originalEvent.preventDefault();
                e.originalEvent.stopPropagation();
                onTargetClear?.();
            }
        });
        return null;
    };

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
            setMavLogs((prev) => [...prev, data.text].slice(-50));
        };
        socket.on("pixhawk-feedback", handleMavLog);
        return () => socket.off("pixhawk-feedback", handleMavLog);
    }, [socket]);

    useEffect(() => {
        if (isTerminalOpen) logEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [mavLogs, isTerminalOpen]);

    useEffect(() => {
        if (isGpsLocked && !hasInitialGpsAutoSwitch) {
            setFlightMode("LOITER");
            setHasInitialGpsAutoSwitch(true);
        } else if (!isGpsLocked) {
            setFlightMode("ALT_HOLD");
            setHasInitialGpsAutoSwitch(false);
        }
    }, [isGpsLocked, hasInitialGpsAutoSwitch]);

    const lat = gpsData.lat ? Number(gpsData.lat) : 31.787396049566723;
    const lon = gpsData.lon ? Number(gpsData.lon) : 35.224925554289065;
    const position = useMemo(() => [lat, lon], [lat, lon]);

    const mapTiles = isDarkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    useEffect(() => {
        if (!socket) return;
        socket.on("telemetryMessage", (data) => {
            lastTelTime.current = Date.now();
            setGotTheTelMessage(data);
            const calculatedPing = Date.now() - lastEmitTime.current;
            if (data.theTelMessage?.online) setDroneOnline(true);
            setPing(calculatedPing < 0 ? 20 : calculatedPing);
            if (data.theTelMessage?.cam_url && data.theTelMessage.cam_url !== primaryLink) {
                setPrimaryLink(data.theTelMessage.cam_url);
            }
        });
        return () => socket.off("telemetryMessage");
    }, [socket, primaryLink]);

    useEffect(() => {
        const checkConnection = setInterval(() => {
            if (Date.now() - lastTelTime.current > 5000) setDroneOnline(false);
        }, 500);
        return () => clearInterval(checkConnection);
    }, []);

    useEffect(() => {
        if (!socket) return;
        let interval = setInterval(() => {
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
        }, 100);
        return () => clearInterval(interval);
    }, [socket, speed, flightMode, altitude, markerPoints]);

    const handleModeChange = (newMode) => {
        if (!droneOnline) return;
        if (!isGpsLocked && newMode !== "ALT_HOLD") return;
        socket.emit("user-message", { commands: [], flight_mode: newMode, altitude: altitude });
        setFlightMode(newMode);
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
    const handleTakeoff5m = () => socket?.emit('user-message', { commands: ["fly"] });
    const handleMissionExecute = () => {
        if (markerPoints.length) {
            activeKeys.current.add("execute");
            setTimeout(() => activeKeys.current.delete("execute"), 500);
        }
    };

    const ModeSlider = () => {
        const modes = ["ALT_HOLD", "LOITER", "GUIDED"];
        const currentIndex = modes.indexOf(flightMode);
        const getModeColor = () => {
            if (flightMode === "ALT_HOLD") return "bg-orange-500 shadow-orange-500/50";
            if (flightMode === "LOITER") return "bg-purple-500 shadow-purple-500/50";
            return "bg-emerald-500 shadow-emerald-500/50";
        };
        return (
            <div className="flex flex-col items-center mt-2 pointer-events-auto">
                <div className="relative w-40 h-8 flex items-center">
                    <div className={`absolute w-full h-2 rounded-full transition-colors duration-500 ${getModeColor()} opacity-20`} />
                    <div className={`absolute h-2 rounded-full transition-all duration-500 ${getModeColor()}`} style={{ width: `${(currentIndex / 2) * 100}%`, left: 0 }} />
                    <div className="absolute w-full flex justify-between px-1">
                        {modes.map((m) => (
                            <button key={m} onClick={() => handleModeChange(m)} className={`size-4 rounded-full border-2 border-white/20 z-10 transition-all ${flightMode === m ? getModeColor() : 'bg-black/60'}`} />
                        ))}
                    </div>
                </div>
                <span className={`text-[8px] font-black uppercase mt-1 tracking-tighter transition-colors ${getModeColor().replace('bg-', 'text-')}`}>{flightMode.replace('_', ' ')}</span>
            </div>
        );
    };

    return (
        <div className="h-[100dvh] w-full bg-black overflow-hidden relative">
            {isAutonomous ? (
                <div className="h-full w-full flex flex-col relative">
                    <header onPointerDown={(e) => e.preventDefault()} className="w-full py-1 lg:py-3 flex flex-col items-center bg-black/60 backdrop-blur-md border-b border-white/10 z-[110] pointer-events-auto select-none">
                        <div className="flex flex-row items-center justify-center gap-3 lg:gap-8 w-full px-4 relative">
                            {targetPos && (
                                <div className="absolute left-2 lg:left-4 top-1/2 -translate-y-1/2 text-emerald-500 font-mono leading-tight border-l-2 border-emerald-500/50 pl-2 animate-pulse hidden md:block">
                                    <p className="text-[6px] lg:text-[8px] uppercase opacity-50 font-black tracking-tighter">Target Lock</p>
                                    <p className="text-[8px] lg:text-[11px] font-bold">LA: {targetPos[0].toFixed(10)}</p>
                                    <p className="text-[8px] lg:text-[11px] font-bold">LO: {targetPos[1].toFixed(10)}</p>
                                </div>
                            )}
                            <div className="flex flex-col items-center gap-1">
                                <span className={`text-[6px] lg:text-[7px] font-black uppercase tracking-tighter ${isAutonomous ? 'text-purple-400' : 'text-emerald-400'}`}>{isAutonomous ? 'Autonomous' : 'Manual'}</span>
                                <button onClick={() => setIsAutonomous(!isAutonomous)} className={`relative w-10 lg:w-12 h-5 lg:h-6 rounded-full border transition-all ${isAutonomous ? 'bg-purple-900/30 border-purple-500/50' : 'bg-emerald-900/30 border-emerald-500/50'}`}>
                                    <div className={`absolute top-1/2 -translate-y-1/2 size-3 lg:size-4 rounded-full transition-all flex items-center justify-center ${isAutonomous ? 'left-[calc(100%-16px)] lg:left-[calc(100%-20px)] bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'left-1 bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}>
                                        {isAutonomous ? <Rocket size={8} className="text-black" /> : <ShieldAlert size={8} className="text-black" />}
                                    </div>
                                </button>
                            </div>
                            <div className="flex gap-3 lg:gap-6">{[{ l: 'R', v: tel?.motors?.[0] }, { l: 'P', v: tel?.motors?.[1] }].map((x, i) => (<div key={i} className="flex flex-col items-center"><span className="text-[7px] text-gray-400 uppercase">{x.l}</span><span className="text-sm lg:text-lg font-black text-pink-500">{x.v || 1500}</span></div>))}</div>
                            <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm">Panda Console</h1>
                            <div className="flex gap-3 lg:gap-6">{[{ l: 'Y', v: tel?.motors?.[2] }, { l: 'T', v: tel?.motors?.[3] }].map((x, i) => (<div key={i} className="flex flex-col items-center"><span className="text-[7px] text-gray-400 uppercase">{x.l}</span><span className="text-sm lg:text-lg font-black text-pink-500">{x.v || 1500}</span></div>))}</div>
                        </div>
                        <div className="absolute right-4 top-4 size-3 lg:size-4 rounded-full shadow-lg" style={{ backgroundColor: droneOnline ? '#10b981' : '#dc2626' }} />
                        <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-[10px] lg:text-base uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}>
                            <Satellite size={isMobile ? 12 : 16} /> {droneOnline ? satCount : 0} Satellites
                        </div>
                    </header>

                    <div className="flex-1 relative overflow-hidden">
                        <div className="absolute inset-0 z-0">
                            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000] pointer-events-auto"><button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="flex items-center gap-2 px-4 py-2 bg-black/60 border border-white/20 rounded-full text-emerald-300 hover:bg-black/80 transition">{isDarkMode ? <Sun size={16} /> : <Moon size={16} />}<span className="text-[10px] uppercase font-black">{isDarkMode ? 'Light' : 'Dark'} Mode</span></button></div>
                            {targetPos && (
                                <div style={{ position: 'absolute', top: '4rem', right: isRightBarOpen ? (isMobile ? '12rem' : '20rem') : '1rem', zIndex: 1000 }} className="pointer-events-auto transition-all duration-500 ease-in-out">
                                    <button onClick={(e) => { e.stopPropagation(); handleClearTarget(); }} className={`flex items-center gap-1 px-2 py-2 rounded-full transition ${isDarkMode ? 'bg-white/10 border border-white/60 text-white' : 'bg-black border border-black/70 text-white'}`}>
                                        <X size={10} /> <span className="text-[10px] font-black">Clear</span>
                                    </button>
                                </div>
                            )}
                            <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}>
                                <TileLayer url={mapTiles} />
                                <MapClickHandler onTargetClear={handleClearTarget} />
                                <Marker position={position} key={`drone-auto-${lat}-${lon}`} />
                                {targetPos && (<><Marker position={targetPos} icon={createColoredIcon(targetColor)} /><Polyline positions={[position, targetPos]} color={targetColor} weight={2} dashArray="5, 10" opacity={0.8} /></>)}
                                <RecenterMap coords={position} />
                            </MapContainer>
                        </div>

                        {/* LEFT SIDEBAR */}
                        <div className={`absolute left-0 top-0 bottom-0 z-20 transition-transform duration-500 flex items-center select-none ${isLeftBarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
                            <div className="w-44 lg:w-75 h-[95%] bg-black/20 backdrop-blur-sm border-r border-white/10 rounded-r-3xl p-2">

                                {/* --- ADDED GRIPPER CONTROLS --- */}
                                <div className="mt-6 flex flex-col gap-3 px-2">
                                    <label className="text-[8px] text-emerald-500/50 uppercase font-black">Gripper Control</label>

                                    <button
                                        onPointerUp={(e) => {
                                            e.stopPropagation();
                                            socket?.emit("user-message", { commands: ["open_gripper"] });
                                        }}
                                        className="w-full py-3 bg-orange-500/20 border border-orange-500/50 rounded-xl text-orange-400 text-[10px] font-black hover:bg-orange-500 hover:text-black transition-all active:scale-95"
                                    >
                                        OPEN (1900)
                                    </button>

                                    <button
                                        onPointerUp={(e) => {
                                            e.stopPropagation();
                                            socket?.emit("user-message", { commands: ["close_gripper"] });
                                        }}
                                        className="w-full py-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-400 text-[10px] font-black hover:bg-emerald-500 hover:text-black transition-all active:scale-95"
                                    >
                                        CLOSE (1100)
                                    </button>
                                </div>

                                <p className="text-[10px] text-gray-500 uppercase font-bold">Mission Params</p>
                            </div>
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsLeftBarOpen(!isLeftBarOpen); }} className="absolute left-full bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-r-lg text-emerald-500 z-[1002] pointer-events-auto"><ArrowRight size={16} className={`transition-transform ${isLeftBarOpen ? 'rotate-180' : ''}`} /></button>
                        </div>

                        {/* RIGHT SIDEBAR */}
                        <div className={`absolute right-0 top-0 bottom-0 z-20 transition-transform duration-500 flex items-center flex-row-reverse select-none ${isRightBarOpen ? 'translate-x-0' : 'translate-x-full'}`}>
                            <div className="w-44 lg:w-75 h-[95%] bg-black/20 backdrop-blur-sm border-l border-white/10 rounded-l-3xl p-2 flex flex-col justify-between">
                                <div className="flex-1"><p className="text-[10px] text-gray-500 uppercase font-bold text-right">Navigation Data</p></div>
                                <div className="flex flex-col gap-1 pb-2">
                                    <div className="flex items-center gap-2">
                                        <div className="flex-1 bg-black/30 border border-emerald-500/30 rounded-lg px-1 py-0.5"><input type="text" placeholder="lat, lon" onPointerDown={(e) => e.stopPropagation()} className={`w-full bg-transparent border-none text-[8px] font-mono focus:ring-0 outline-none select-text ${isDarkMode ? 'text-emerald-400' : 'text-black'}`} value={coordInput} onChange={(e) => setCoordInput(e.target.value)} /></div>
                                        <button onClick={(e) => { e.stopPropagation(); const c = coordInput.split(',').map(x => parseFloat(x.trim())); if (c.length === 2 && !isNaN(c[0])) { addMarkerPoint([c[0], c[1]]); setCoordInput(""); } }} className="bg-emerald-600 text-black font-black text-[7px] px-2 py-1.5 rounded-lg active:scale-95">Confirm</button>
                                    </div>
                                    <button onClick={(e) => { e.stopPropagation(); if (!markerPoints.length) return; handleMissionExecute(); setMissionExecuted(true); setTimeout(() => setMissionExecuted(false), 5000); }} disabled={!markerPoints.length} className={`w-full text-black font-black text-[12px] py-2 rounded-lg active:scale-95 ${markerPoints.length ? 'bg-purple-600 shadow-[0_0_10px_#a855f7]' : 'bg-slate-400 cursor-not-allowed'}`}>EXECUTE</button>
                                </div>
                            </div>
                            <button onPointerDown={(e) => e.stopPropagation()} onClick={(e) => { e.stopPropagation(); setIsRightBarOpen(!isRightBarOpen); }} className="absolute right-full bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-l-lg text-emerald-500 z-[1002] pointer-events-auto"><ArrowRight size={16} className={`transition-transform ${isRightBarOpen ? '' : 'rotate-180'}`} /></button>
                        </div>

                        {/* FLOAT HUD */}
                        <div className="absolute left-1/2 bottom-4 z-30 -translate-x-1/2 flex items-end gap-6 pointer-events-auto">
                            <div className="flex flex-col items-center">
                                <span className="text-[10px] text-blue-400 font-black font-mono leading-none mb-1">{altitude}m</span>
                                <div className="relative w-6 h-28 bg-black/60 border border-blue-500/30 rounded-full flex flex-col-reverse p-0.5 overflow-hidden"><input type="range" min="0" max="20" step="1" value={altitude} onChange={(e) => setAltitude(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} /><div className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-full" style={{ height: `${(altitude / 20) * 100}%` }} /></div>
                                <p className="text-[8px] text-blue-500 uppercase font-black mt-1">Alt</p>
                            </div>
                            <div className="flex flex-col items-center w-36 lg:w-64 pb-2">
                                <div className="flex justify-between w-full px-1 mb-1"><span className="text-[7px] text-orange-400 font-black uppercase">Vel Limit</span><span className="text-[9px] text-orange-400 font-mono">{speed}%</span></div>
                                <div className="relative w-full h-5 bg-black/60 border border-orange-500/30 rounded-full p-0.5 overflow-hidden"><input type="range" min="0" max="100" step="5" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10" /><div className="h-full bg-gradient-to-r from-orange-700 to-orange-400 rounded-full" style={{ width: `${speed}%` }} /></div>
                            </div>
                            <div ref={sliderRef} style={{ touchAction: 'none' }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }} onPointerMove={(e) => { if (!isDraggingSlider || !sliderRef.current) return; const r = sliderRef.current.getBoundingClientRect(); let dy = Math.max(-(r.height / 2 - 10), Math.min(r.height / 2 - 10, e.clientY - (r.top + r.height / 2))); setYPos(dy); const t = (r.height / 2 - 10) * 0.7; if (!hasTriggeredAction.current) { if (dy <= -t) { activeKeys.current.add("arm"); hasTriggeredAction.current = true; setTimeout(() => activeKeys.current.delete("arm"), 500); } else if (dy >= t) { activeKeys.current.add("land"); hasTriggeredAction.current = true; setTimeout(() => activeKeys.current.delete("land"), 500); } } }} onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }} className="relative w-10 lg:w-14 h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center shadow-xl overflow-visible"><div className="absolute top-2 text-[5px] text-emerald-500 opacity-40 uppercase">Arm</div><div className="absolute bottom-2 text-[5px] text-orange-500 opacity-40 uppercase">Land</div><div className="w-full h-0.5 bg-white/10 absolute" /><div className={`absolute w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse ${(isArmedFromTel || yPos < -20) ? "bg-emerald-500 rounded-md shadow-[0_0_20px_#10b981]" : (yPos > 20) ? "bg-orange-500 rounded-full shadow-[0_0_20px_#f97316]" : "bg-purple-600 shadow-[0_0_20px_#9333ea]"}`} style={{ transform: `translateY(${yPos}px)`, clipPath: (isArmedFromTel || yPos < -20 || yPos > 20) ? "none" : "polygon(50% 0%, 0% 100%, 100% 100%)" }}>{(isArmedFromTel || yPos < -20) ? <Power size={14} className="text-black" /> : (yPos > 20) ? <ArrowDownToLine size={14} className="text-black" /> : <Circle size={6} className="text-white" />}</div></div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative">
                    {/* Manual Mode UI */}
                    {isMobile && !isStarted && (
                        <div className={`fixed inset-0 z-[200] bg-[#050a05] flex flex-col items-center justify-center p-8 transition-transform duration-1000 ${isStarted ? '-translate-y-full' : 'translate-y-0'}`}>
                            <Rocket size={48} className="text-emerald-500 mb-4 animate-bounce" /><h2 className="text-emerald-500 font-black text-3xl tracking-[0.2em] uppercase green-glow">Panda Console</h2><button onClick={handleStartConsole} className="px-12 py-4 bg-emerald-600/20 border-2 border-emerald-500 rounded-full text-emerald-400 font-black mt-12">LAUNCH SYSTEM</button>
                        </div>
                    )}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                        <div className="absolute top-[40%] left-1/2 -translate-x-1/2 text-center z-20 w-full"><p className="text-emerald-400 font-mono text-[10px] tracking-[0.3em] uppercase animate-pulse">{droneOnline ? "Receiving Data Stream" : "Searching for Drone"}</p></div>
                    </div>
                    <div className="absolute top-14 left-2 z-30 flex flex-col font-mono text-emerald-400 pointer-events-none bg-black/50 p-1.5 rounded-md border border-white/10 backdrop-blur-sm shadow-xl max-w-fit">
                        {/* Header / Ping - Shrunk text and icon */}
                        <div className="flex items-center gap-1 mb-0.5 border-b border-emerald-500/10 pb-0.5 text-blue-400">
                            <Signal size={12} />
                            <span className="font-black text-[9px] tracking-tighter">P: {ping}ms</span>
                        </div>

                        {/* Main Data - Tightened gaps and smaller text */}
                        <div className="flex flex-col gap-0 text-[8px] leading-tight">
                            <p><span className="opacity-40 uppercase">Lat:</span> {gpsData.lat?.toFixed(5) || "---"}</p>
                            <p><span className="opacity-40 uppercase">Lon:</span> {gpsData.lon?.toFixed(5) || "---"}</p>
                            <p><span className="opacity-40 uppercase">Sat:</span> {gpsData.sats || 0}</p>
                            <p className="text-blue-400"><span className="opacity-40 uppercase">Alt:</span> {gpsData.alt?.toFixed(1) || "0.0"}M</p>
                            <p><span className="opacity-40 uppercase">Spd:</span> {gpsData.vel?.toFixed(1) || "0.0"}M/S</p>
                            <p className={`${gpsStatus.color} font-bold`}><span className="opacity-40 text-emerald-400 uppercase">GPS:</span> {gpsStatus.text}</p>
                        </div>

                        {/* Battery - Compact version */}
                        <div className="flex items-center gap-1.5 mt-1 pt-0.5 border-t border-white/5">
                            <div className={`px-1 rounded-[3px] text-[8px] font-black ${(tel?.battery?.p || 0) < 20 ? 'bg-red-500 animate-pulse text-white' : 'bg-emerald-600/20 text-emerald-400'}`}>
                                {tel?.battery?.p || 0}%
                            </div>
                            <span className="text-[8px] font-mono text-blue-400/80">{tel?.battery?.v?.toFixed(1) || "0.0"}V</span>
                        </div>
                    </div>
                    <div className={`fixed left-0 top-1/2 -translate-y-1/2 z-[100] flex items-center transition-all duration-500 ${isTerminalOpen ? "translate-x-0" : "-translate-x-64"}`}>
                        <div className="w-64 h-72 bg-black/90 backdrop-blur-xl border border-white/10 rounded-r-2xl shadow-xl flex flex-col overflow-hidden">
                            <div className="bg-white/5 px-3 py-2 border-b border-white/10 flex justify-between items-center font-black text-[10px] text-emerald-500 uppercase">Mavlink Console</div>
                            <div className="flex-1 overflow-y-auto p-3 font-mono text-[9px] space-y-1.5 terminal-scrollbar">{mavLogs.map((log, i) => (<div key={i} className="flex gap-2 border-l border-white/5 pl-2"><span className="text-emerald-900">root@drone:~#</span><span className={log.includes("REJECTED") ? "text-red-400" : "text-emerald-400"}>{log}</span></div>))}<div ref={logEndRef} /></div>
                        </div>
                        <button onClick={() => setIsTerminalOpen(!isTerminalOpen)} className="bg-emerald-500/10 backdrop-blur-md border border-emerald-500/30 p-2 rounded-r-xl text-emerald-500"><ArrowRight size={18} className={`${isTerminalOpen ? "rotate-180" : ""}`} /></button>
                    </div>
                    <div className="absolute inset-0 z-10 flex flex-col pointer-events-auto">
                        <header className="w-full py-1 lg:py-3 flex flex-col items-center bg-black/40 backdrop-blur-md border-b border-white/10 relative">

                            <div className="flex flex-row items-center justify-center gap-3 lg:gap-8 w-full px-4 relative">
                                <div>
                                    {authUser ? (
                                        <div className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/20 bg-white/5 backdrop-blur-sm">
                                            <div className="w-6 h-6 rounded-full bg-purple-900 flex items-center justify-center text-[10px] font-semibold text-purple-300 shrink-0">
                                                {authUser.fullname?.slice(0, 2).toUpperCase() ?? 'U'}
                                            </div>
                                            <span className="text-xs font-medium text-white/80 leading-none">
                                                {authUser.fullname ?? 'Pilot'}
                                            </span>
                                            <ChevronDown size={11} className="text-white/40" />
                                        </div>
                                    ) : (
                                        <div
                                            onClick={() => navigate('/login')}
                                            className="flex items-center gap-2 px-2.5 py-1 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm cursor-pointer hover:border-white/20 transition-colors"
                                        >
                                            <div className="w-6 h-6 rounded-full border border-dashed border-white/20 flex items-center justify-center">
                                                <User size={12} className="text-white/40" />
                                            </div>
                                            <span className="text-xs text-white/40 leading-none">Sign in</span>
                                            <ArrowRight size={11} className="text-white/30" />
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <span className={`text-[6px] lg:text-[7px] font-black uppercase tracking-tighter transition-colors ${isAutonomous ? 'text-purple-400' : 'text-emerald-400'}`}>{isAutonomous ? 'Autonomous' : 'Manual'}</span>
                                    <button onClick={() => setIsAutonomous(!isAutonomous)} className={`relative w-10 lg:w-12 h-5 lg:h-6 rounded-full border transition-all ${isAutonomous ? 'bg-purple-900/30 border-purple-500/50' : 'bg-emerald-900/30 border-emerald-500/50'}`}><div className={`absolute top-1/2 -translate-y-1/2 size-3 lg:size-4 rounded-full transition-all flex items-center justify-center ${isAutonomous ? 'left-[calc(100%-16px)] lg:left-[calc(100%-20px)] bg-purple-500 shadow-[0_0_10px_#a855f7]' : 'left-1 bg-emerald-500 shadow-[0_0_10px_#10b981]'}`}>{isAutonomous ? <Rocket size={8} /> : <ShieldAlert size={8} />}</div></button>
                                </div>
                                <div className="flex gap-3 lg:gap-6">{[{ l: 'R', v: tel?.motors?.[0] }, { l: 'P', v: tel?.motors?.[1] }].map((x, i) => (<div key={i} className="flex flex-col items-center"><span className="text-[7px] text-gray-400 uppercase">{x.l}</span><span className="text-sm lg:text-lg font-black text-pink-500">{x.v || 1500}</span></div>))}</div>
                                <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm">Panda Console</h1>
                                <div className="flex gap-3 lg:gap-6">{[{ l: 'Y', v: tel?.motors?.[2] }, { l: 'T', v: tel?.motors?.[3] }].map((x, i) => (<div key={i} className="flex flex-col items-center"><span className="text-[7px] text-gray-400 uppercase">{x.l}</span><span className="text-sm lg:text-lg font-black text-pink-500">{x.v || 1500}</span></div>))}</div>
                            </div>
                            <div className="absolute right-4 top-4 size-3 lg:size-4 rounded-full shadow-lg" style={{ backgroundColor: droneOnline ? '#10b981' : '#dc2626' }} />
                            <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-[10px] lg:text-base uppercase ${!droneOnline ? 'text-red-500 animate-pulse' : 'text-emerald-500'}`}><Satellite size={isMobile ? 12 : 16} /> {droneOnline ? satCount : 0} Satellites</div>
                        </header>
                        <div className="flex flex-col items-center"><ModeSlider />{!isGpsLocked && <span className="text-[10px] text-red-500 font-bold mt-1 uppercase">GPS REQUIRED FOR LOITER/GUIDED</span>}</div>
                        <div className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 lg:gap-2 z-50 pointer-events-auto">
                            <span className="text-[10px] text-blue-400 font-black font-mono">{altitude}m</span>
                            <div className="relative w-6 h-32 lg:w-10 lg:h-72 bg-black/60 border border-blue-500/30 rounded-full flex flex-col-reverse p-0.5 overflow-hidden shadow-2xl">
                                <input type="range" min="0" max="20" step="1" value={altitude} onChange={(e) => setAltitude(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                                <div className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-full transition-all duration-300" style={{ height: `${(altitude / 20) * 100}%` }} />
                            </div>
                            <p className="text-[7px] text-blue-500 uppercase font-black vertical-text mt-2">Altitude</p>
                        </div>
                        <main className="flex-1 w-full flex flex-row items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12">
                            <div className="flex-1 flex items-center justify-start gap-4 lg:gap-8 pointer-events-auto">
                                <div className="flex flex-col items-center ml-4 mb-2 lg:ml-10 lg:mb-6"><p className="text-[8px] text-emerald-500/40 uppercase italic tracking-widest font-bold mb-2">Movement</p><Joystick onMove={(dx, dy, r) => { const t = r * 0.3; const d = new Set(); if (dy < -t) d.add("forward"); if (dy > t) d.add("backward"); if (dx < -t) d.add("left"); if (dx > t) d.add("right"); leftJoyDirs.current = d; }} /></div>
                                <button onClick={handleTakeoff5m}
                                    className="size-12 lg:size-22 rounded-full bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 flex flex-col items-center justify-center active:scale-90 mb-2 shadow-lg">
                                    <Rocket size={30} />
                                    <span className="text-[7px] lg:text-[15px] font-black uppercase mt-1 leading-none">Fly</span></button>
                            </div>
                            <div className="flex-none flex flex-row items-end justify-center gap-2 lg:gap-10 mb-2 pointer-events-auto">
                                <div className="flex flex-col gap-1 w-48 lg:w-80 justify-end items-center">
                                    <div className="flex flex-col items-center w-full px-2 mb-1 pointer-events-auto">
                                        <div className="flex justify-between w-full px-1 mb-1"><span className="text-[8px] text-orange-400 font-black uppercase">Velocity Limit</span><span className="text-[10px] text-orange-400 font-mono font-bold">{speed}%</span></div>
                                        <div className="relative w-full h-6 bg-black/60 border border-orange-500/30 rounded-full p-0.5 overflow-hidden shadow-2xl flex items-center"><input type="range" min="0" max="100" step="5" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer appearance-none z-10" /><div className="h-full bg-gradient-to-r from-orange-700 to-orange-400 rounded-full transition-all duration-300" style={{ width: `${speed}%` }} /></div>
                                    </div>
                                    <div className="bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-1.5 rounded-xl shadow-2xl w-full text-center"><p className={`text-xs lg:text-sm font-black uppercase ${droneOnline ? "text-emerald-400" : "text-red-500"}`}>{droneOnline ? (tel?.status_msg || "LINKED") : "OFFLINE"}</p><div className="grid grid-cols-3 text-center text-[#2dd4bf] font-mono text-[7px] border-t border-white/5 mt-1 pt-1"><div>{lat.toFixed(1)}</div><div>{lon.toFixed(1)}</div><div>{tel?.theta?.toFixed(1) || "0.0"}</div></div></div>
                                    <button onClick={handleForceDisarm} className="w-full py-1.5 bg-red-600/20 border border-red-500/40 rounded-lg text-red-500 font-black text-[8px] lg:text-[10px] uppercase active:scale-95 shadow-xl">FORCE KILL</button>
                                </div>
                                <div ref={sliderRef} style={{ touchAction: 'none' }} onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }} onPointerMove={(e) => { if (!isDraggingSlider || !sliderRef.current) return; const r = sliderRef.current.getBoundingClientRect(); let dy = Math.max(-(r.height / 2 - 10), Math.min(r.height / 2 - 10, e.clientY - (r.top + r.height / 2))); setYPos(dy); const t = (r.height / 2 - 10) * 0.7; if (!hasTriggeredAction.current) { if (dy <= -t) { activeKeys.current.add("arm"); hasTriggeredAction.current = true; setTimeout(() => activeKeys.current.delete("arm"), 500); } else if (dy >= t) { activeKeys.current.add("land"); hasTriggeredAction.current = true; setTimeout(() => activeKeys.current.delete("land"), 500); } } }} onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }} className="relative w-10 lg:w-14 h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center shadow-xl overflow-visible"><div className="absolute top-2 text-[5px] text-emerald-500 opacity-40 uppercase">Arm</div><div className="absolute bottom-2 text-[5px] text-orange-500 opacity-40 uppercase">Land</div><div className="w-full h-0.5 bg-white/10 absolute" /><div className={`absolute w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center shadow-2xl transition-all duration-150 animate-pulse ${(isArmedFromTel || yPos < -20) ? "bg-emerald-500 rounded-md shadow-[0_0_20px_#10b981]" : (yPos > 20) ? "bg-orange-500 rounded-full shadow-[0_0_20px_#f97316]" : "bg-purple-600 shadow-[0_0_20px_#9333ea]"}`} style={{ transform: `translateY(${yPos}px)`, clipPath: (isArmedFromTel || yPos < -20 || yPos > 20) ? "none" : "polygon(50% 0%, 0% 100%, 100% 100%)" }}>{(isArmedFromTel || yPos < -20) ? <Power size={14} className="text-black" /> : (yPos > 20) ? <ArrowDownToLine size={14} className="text-black" /> : <Circle size={6} className="text-white" />}</div></div>

                            </div>
                            <div className="flex-1 flex justify-end items-center pointer-events-auto"><div className="flex flex-col items-center mr-4 mb-2 lg:mr-10 lg:mb-6"><p className="text-[8px] text-emerald-500/40 uppercase font-bold mb-2 italic">Yaw / Rotate</p><Joystick onMove={(dx, dy, r) => { const t = r * 0.3; const d = new Set(); if (dx < -t) d.add("rotate_left"); if (dx > t) d.add("rotate_right"); rightJoyDirs.current = d; }} /></div></div>
                        </main>
                    </div>

                    <div onClick={() => !isMapExpanded && setIsExpanded(true)} className={`transition-all duration-500 z-[100] border-2 border-emerald-500/30 overflow-hidden ${isMapExpanded ? 'absolute top-0 right-0 w-1/2 h-screen border-l bg-black shadow-[-20px_0_30px_rgba(0,0,0,0.5)]' : 'absolute top-4 right-10 w-25 h-25 lg:w-28 lg:h-28 rounded-2xl shadow-xl cursor-pointer hover:border-emerald-400'}`}>
                        <div className="absolute top-3 left-3 flex flex-col gap-2 z-[1001]"><button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-emerald-400">{isDarkMode ? <Sun size={14} /> : <Moon size={14} />}</button></div>
                        {isMapExpanded && <button onClick={(e) => { e.stopPropagation(); setIsExpanded(false); }} className="absolute top-3 right-3 z-[1001] bg-red-600 p-2 rounded-lg text-white shadow-lg pointer-events-auto"><X size={20} /></button>}
                        <MapContainer center={position} zoom={16} style={{ height: '100%', width: '100%' }} zoomControl={false} attributionControl={false}><TileLayer url={mapTiles} /><MapClickHandler onTargetClear={handleClearTarget} /><Marker position={position} key={`drone-manual-${lat}-${lon}`} />{targetPos && (<><Marker position={targetPos} icon={createColoredIcon(targetColor)} /><Polyline positions={[position, targetPos]} color={targetColor} weight={2} dashArray="5, 10" /></>)}<RecenterMap coords={position} /><MapResizer isExpanded={isMapExpanded} /></MapContainer>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{
                __html: `
                .green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } 
                .vertical-text { writing-mode: vertical-rl; }
                .vertical-slider { 
    writing-mode: bt-lr !important; 
    -webkit-appearance: slider-vertical !important; 
}
                .terminal-scrollbar::-webkit-scrollbar { width: 4px; }
                .terminal-scrollbar::-webkit-scrollbar-track { background: rgba(0, 0, 0, 0.2); }
                .terminal-scrollbar::-webkit-scrollbar-thumb { background: #10b981; border-radius: 10px; }
                * { -webkit-tap-highlight-color: transparent !important; }
                .map-container, .joystick-container, .slider-block { touch-action: none !important; }
                input[type=text] { touch-action: auto !important; -webkit-user-select: text !important; user-select: text !important; cursor: text !important; }
            ` }} />
        </div>
    );
};