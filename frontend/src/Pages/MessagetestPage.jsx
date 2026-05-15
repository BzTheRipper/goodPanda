import React, { useState, useEffect, useRef, useCallback, memo, useMemo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    Power, Circle, ShieldAlert, ExternalLink, X, Maximize2, Rocket, Signal, Sun, Moon, Satellite, ChevronRight
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
    const [isStarted, setIsStarted] = useState(false); // Controls the Swipe Screen
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
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);

    // --- REFS ---
    const sliderRef = useRef(null);
    const startSliderRef = useRef(null);
    const [startX, setStartX] = useState(0);
    const hasTriggeredAction = useRef(false);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());
    const [yPos, setYPos] = useState(0);
    const lastEmitTime = useRef(Date.now());

    // --- DATA CALCULATIONS ---
    const tel = gotTheTelMessage?.theTelMessage;
    const isArmedFromTel = tel?.is_armable || false;
    const gpsData = tel?.gps_raw || {};
    const satCount = gpsData.sats || 0;

    const lat = gpsData.lat ? Number(gpsData.lat) : 31.787396049566723;
    const lon = gpsData.lon ? Number(gpsData.lon) : 35.224925554289065;

    const position = useMemo(() => [gpsData.lat || 31.787396049566723, gpsData.lon || 35.224925554289065], [gpsData.lat, gpsData.lon]);
    const mapTiles = isDarkMode
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    // --- SOCKETS ---
    useEffect(() => {
        if (!socket) return;
        socket.on("message", (msg) => setGotTheMessage(msg));
        socket.on("telemetryMessage", (data) => {
            setGotTheTelMessage(data);
            setPing(Date.now() - lastEmitTime.current);
            const incomingUrl = data.theTelMessage?.cam_url;
            if (incomingUrl && incomingUrl !== primaryLink) {
                setPrimaryLink(incomingUrl);
                setIsFPVActive(false);
            }
        });
        return () => { socket.off("message"); socket.off("telemetryMessage"); };
    }, [socket, primaryLink]);

    useEffect(() => {
        if (!socket) return;
        let interval = setInterval(() => {
            lastEmitTime.current = Date.now();
            const combined = new Set([...Array.from(activeKeys.current), ...Array.from(leftJoyDirs.current), ...Array.from(rightJoyDirs.current)]);
            const cmdArray = Array.from(combined);
            setVisualCommands(cmdArray);
            socket.emit("user-message", { commands: cmdArray, altitude });
        }, 100);
        return () => clearInterval(interval);
    }, [socket, altitude]);

    // --- KEYBOARD ---
    useEffect(() => {
        const keyMap = { 'w': 'forward', 's': 'backward', 'a': 'left', 'd': 'right', 'arrowup': 'up', 'arrowdown': 'down', 'arrowleft': 'rotate_left', 'arrowright': 'rotate_right', 'k': 'arm', 'l': 'land' };
        const down = (e) => { if (keyMap[e.key.toLowerCase()]) { e.preventDefault(); activeKeys.current.add(keyMap[e.key.toLowerCase()]); } };
        const up = (e) => { if (keyMap[e.key.toLowerCase()]) activeKeys.current.delete(keyMap[e.key.toLowerCase()]); };
        window.addEventListener("keydown", down); window.addEventListener("keyup", up);
        return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
    }, []);

    // --- MOBILE START LOGIC ---
    const handleStartSwipe = async (e) => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) await element.requestFullscreen();
            if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            setIsStarted(true);
        } catch (err) {
            setIsStarted(true); // Fallback if fullscreen fails
        }
    };

    const handleForceDisarm = () => socket?.emit('user-message', { commands: ["force_disarm"], altitude });
    const handleTakeoff5m = () => socket?.emit('user-message', { commands: ["fly"], altitude: 5 });
    const activateFPV = () => { window.open(primaryLink, '_blank'); setIsFPVActive(true); };

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative" style={{ touchAction: 'none' }}>

            {/* --- MOBILE SWIPE OVERLAY --- */}
            {isMobile && !isStarted && (
                <div className="fixed inset-0 z-[200] bg-[#050a05] flex flex-col items-center justify-center p-8 transition-all duration-700">
                    <div className="mb-12 text-center">
                        <h2 className="text-emerald-500 font-black text-3xl tracking-[0.2em] green-glow uppercase">Panda Console</h2>
                        <p className="text-gray-500 text-xs mt-2 uppercase tracking-widest">Autonomous Flight System</p>
                    </div>

                    {/* The Swipe Button */}
                    <div
                        ref={startSliderRef}
                        className="relative w-72 h-16 bg-white/5 rounded-full border border-emerald-500/30 flex items-center p-1 overflow-hidden group shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                    >
                        <div
                            className="absolute inset-0 flex items-center justify-center pointer-events-none text-emerald-500/40 text-[10px] font-black uppercase tracking-[0.3em]"
                        >
                            Swipe to Start
                        </div>

                        <div
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setStartX(0); }}
                            onPointerMove={(e) => {
                                if (e.buttons !== 1) return;
                                let move = Math.max(0, Math.min(230, e.nativeEvent.offsetX));
                                setStartX(move);
                                if (move > 200) handleStartSwipe();
                            }}
                            onPointerUp={() => setStartX(0)}
                            style={{ transform: `translateX(${startX}px)` }}
                            className="z-10 size-14 bg-emerald-500 rounded-full flex items-center justify-center text-black shadow-[0_0_15px_#10b981] transition-transform duration-75 cursor-grab active:cursor-grabbing"
                        >
                            <ChevronRight size={32} strokeWidth={3} className="animate-pulse" />
                        </div>
                    </div>

                    <div className="mt-12 flex items-center gap-2 opacity-30">
                        <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.3s]" />
                        <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce [animation-delay:-0.15s]" />
                        <div className="size-1.5 bg-emerald-500 rounded-full animate-bounce" />
                    </div>
                </div>
            )}

            {/* LAYER 0: FPV BACKGROUND */}
            <div className="absolute inset-0 z-0 bg-[#050a05] flex items-center justify-center">
                {primaryLink ? (
                    <iframe src={primaryLink} className="w-full h-full border-none opacity-90 block" allow="autoplay; fullscreen" />
                ) : (
                    <div className="relative flex flex-col items-center justify-center">
                        <div className="absolute size-48 border-2 border-emerald-500/10 rounded-full animate-ping" />
                        <div className="absolute size-32 border-2 border-emerald-500/20 rounded-full animate-ping [animation-delay:0.5s]" />
                        <div className="relative size-10 bg-emerald-500/20 rounded-full border border-emerald-500/50 shadow-[0_0_20px_#10b98133] flex items-center justify-center">
                            <div className="size-3 bg-emerald-500 rounded-full animate-pulse" />
                        </div>
                        <div className="mt-56 text-center">
                            <p className="text-emerald-400 font-mono text-[11px] tracking-[0.4em] uppercase animate-pulse">Establishing FPV Link</p>
                        </div>
                    </div>
                )}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
            </div>

            {/* TELEMETRY HUD (FPS STYLE) */}
            <div className="absolute top-14 lg:top-16 left-4 z-30 flex flex-col gap-1 text-[11px] lg:text-[14px] font-mono text-emerald-400 pointer-events-none bg-black/40 p-4 rounded-xl border border-white/10 backdrop-blur-md shadow-2xl">
                <div className="flex items-center gap-2 mb-1 border-b border-emerald-500/20 pb-2 text-blue-400">
                    <Signal size={16} />
                    <span className="font-bold uppercase tracking-widest text-xs">Link: {ping}ms</span>
                </div>
                <p><span className="opacity-40">LAT:</span> {gpsData.lat?.toFixed(6) || "---"}</p>
                <p><span className="opacity-40">LON:</span> {gpsData.lon?.toFixed(6) || "---"}</p>
                <p><span className="opacity-40">SATS:</span> {gpsData.sats || 0}</p>
                <p><span className="opacity-40 text-blue-400">ALT:</span> <span className="text-blue-400 font-bold">{gpsData.alt?.toFixed(1) || "0.0"}M</span></p>
                <p><span className="opacity-40">SPD:</span> {gpsData.vel?.toFixed(1) || "0.0"}M/S</p>
            </div>

            {/* UI HUD OVERLAY */}
            <div className={`absolute inset-0 z-10 flex flex-col pointer-events-none transition-opacity duration-1000 ${isMobile && !isStarted ? 'opacity-0' : 'opacity-100'}`}>
                <header className="w-full py-1 lg:py-2 flex flex-col items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow">Panda Console</h1>
                    <div className={`flex items-center gap-1.5 mt-1 font-black font-mono text-xs lg:text-lg uppercase ${satCount === 0 ? 'text-red-500' : satCount <= 3 ? 'text-purple-500 animate-pulse' : 'text-emerald-500'}`}>
                        <Satellite size={isMobile ? 12 : 18} /> {satCount} Satellites
                    </div>
                    {primaryLink && !isFPVActive && (
                        <button onClick={activateFPV} className="absolute left-6 top-4 px-3 py-1 bg-emerald-500 text-black rounded-full text-[9px] font-bold animate-bounce shadow-lg">ACTIVATE FPV</button>
                    )}
                    <div className="absolute right-4 top-4 size-3 rounded-full shadow-lg" style={{ backgroundColor: isArmedFromTel ? '#10b981' : '#dc2626' }} />
                </header>

                <div className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 lg:gap-2 z-50 pointer-events-auto">
                    <span className="text-[10px] text-blue-400 font-black font-mono">{altitude}m</span>
                    <div className="relative w-6 h-32 lg:w-10 lg:h-72 bg-black/60 border border-blue-500/30 rounded-full flex flex-col-reverse p-0.5 overflow-hidden shadow-2xl">
                        <input type="range" min="0" max="20" step="1" value={altitude} onChange={(e) => setAltitude(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                        <div className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-full transition-all duration-300" style={{ height: `${(altitude / 20) * 100}%` }} />
                    </div>
                    <p className="text-[7px] lg:text-[9px] text-blue-500 uppercase font-black vertical-text mt-2">Altitude</p>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12">
                    <div className="w-1/3 flex items-center justify-start gap-8 lg:gap-20 pointer-events-auto">
                        <div className="flex flex-col items-center">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-2 uppercase italic tracking-widest">Movement</p>
                            <Joystick onMove={(dx, dy, r) => {
                                const t = r * 0.3; const d = new Set();
                                if (dy < -t) d.add("forward"); if (dy > t) d.add("backward");
                                if (dx < -t) d.add("left"); if (dx > t) d.add("right");
                                leftJoyDirs.current = d;
                            }} />
                        </div>
                        <button onClick={handleTakeoff5m} className="size-20 lg:size-28 rounded-full bg-emerald-600/20 border-2 border-emerald-500 text-emerald-400 flex flex-col items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.5)] active:scale-90 transition-all hover:bg-emerald-500 hover:text-black group">
                            <Rocket className="size-8 lg:size-12 group-hover:animate-bounce" />
                            <span className="text-[10px] lg:text-xs font-black uppercase mt-1">Fly 5m</span>
                        </button>
                    </div>

                    <div className="flex-1 flex flex-row items-end justify-center gap-3 lg:gap-10 mb-2 pointer-events-auto">
                        <div className="flex flex-col gap-2 w-28 lg:w-80 justify-end">
                            <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-2 rounded-xl text-center min-h-[40px] flex items-center justify-center'>
                                <p className="text-[8px] lg:text-[11px] text-white font-mono uppercase font-black">{tel?.status_msg || "OFFLINE"}</p>
                            </div>
                            <button onClick={handleForceDisarm} className="w-full py-1.5 bg-red-600/20 border border-red-500/40 rounded-lg text-red-500 font-black text-[8px] lg:text-[10px] uppercase active:scale-95 shadow-xl">FORCE KILL</button>
                        </div>

                        <div ref={sliderRef} style={{ touchAction: 'none' }}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={(e) => {
                                if (!isDraggingSlider || !sliderRef.current) return;
                                const rect = sliderRef.current.getBoundingClientRect();
                                let dy = (e.touches ? e.touches[0].clientY : e.clientY) - (rect.top + rect.height / 2);
                                const maxRange = rect.height / 2 - 10;
                                dy = Math.max(-maxRange, Math.min(maxRange, dy)); setYPos(dy);
                                if (!hasTriggeredAction.current) {
                                    if (dy < -maxRange * 0.8) { socket?.emit('user-message', { commands: ["arm"], altitude }); hasTriggeredAction.current = true; }
                                    else if (dy > maxRange * 0.8) { socket?.emit('user-message', { commands: ["land"], altitude }); hasTriggeredAction.current = true; }
                                }
                            }}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-10 lg:w-14 h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl"
                        >
                            <div className="absolute top-2 text-[5px] lg:text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                            <div className="absolute bottom-2 text-[5px] lg:text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                            <div className="w-full h-0.5 bg-white/10 absolute" />
                            <div className={`absolute w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center transition-all animate-pulse ${(isArmedFromTel || yPos < -15) ? "bg-emerald-500 rounded-md shadow-[0_0_15px_#10b981]" : (yPos > 15) ? "bg-orange-500 rounded-full shadow-[0_0_15px_#f97316]" : "bg-purple-600 shadow-[0_0_15px_#9333ea]"}`}
                                style={{ transform: `translateY(${yPos}px)`, clipPath: (isArmedFromTel || yPos < -15 || yPos > 15) ? "none" : "polygon(50% 0%, 0% 100%, 100% 100%)" }}>
                                {(isArmedFromTel || yPos < -15) ? <Power size={18} /> : (yPos > 15) ? <ArrowDownToLine size={18} /> : <Circle size={8} fill="white" />}
                            </div>
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-end pr-12 lg:pr-0 pointer-events-auto">
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
                ${isMapExpanded ? 'absolute top-0 right-0 w-1/2 h-screen border-l bg-black shadow-[-20px_0_30px_rgba(0,0,0,0.5)] pointer-events-auto' : 'absolute top-4 right-4 w-24 h-24 lg:w-32 lg:h-32 rounded-2xl'}`}>
                <div className="absolute top-3 left-3 flex flex-col gap-2 z-[1001]">
                    <button onClick={(e) => { e.stopPropagation(); setIsDarkMode(!isDarkMode); }} className="bg-black/60 backdrop-blur-md p-1.5 rounded-lg border border-white/10 text-emerald-400"><Sun size={14} /></button>
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
                * { -webkit-tap-highlight-color: transparent !important; }
            ` }} />
        </div>
    );
};