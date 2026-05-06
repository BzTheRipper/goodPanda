import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, 
    ArrowDownToLine, Circle, ShieldAlert, ExternalLink 
} from "lucide-react";

// --- JOYSTICK COMPONENT ---
const Joystick = memo(({ leftSide = true, onMove }) => {
    const baseRef = useRef(null);
    const stickRef = useRef(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const handlePointerMove = (e) => {
        if (!isInteracting || !baseRef.current || !stickRef.current) return;
        const rect = baseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        let dx = e.clientX - centerX;
        let dy = e.clientY - centerY;
        const maxRadius = rect.width / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) {
            dx *= maxRadius / dist;
            dy *= maxRadius / dist;
        }
        stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx, dy, maxRadius);
    };

    const handleRelease = () => {
        setIsInteracting(false);
        if (stickRef.current) stickRef.current.style.transform = `translate(0px, 0px)`;
        onMove(0, 0, 1); 
    };

    return (
        <div className="relative flex flex-col items-center pointer-events-auto">
            <div
                ref={baseRef}
                className="w-28 h-28 lg:w-40 lg:h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 relative flex items-center justify-center shadow-2xl backdrop-blur-sm touch-none"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsInteracting(true); }}
                onPointerMove={handlePointerMove}
                onPointerUp={handleRelease}
                onPointerCancel={handleRelease}
            >
                <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-emerald-500" />
                    <div className="h-full w-0.5 bg-emerald-500 absolute" />
                </div>
                <div ref={stickRef} className="w-10 h-10 lg:w-14 lg:h-14 rounded-full shadow-2xl flex items-center justify-center bg-[#2dd4bf] pointer-events-none will-change-transform">
                    <div className="w-3 h-3 rounded-full border border-black/10" />
                </div>
            </div>
        </div>
    );
});

export const MessagetestPage = () => {
    const { socket } = useAuthState();
    const [gotTheMessage, setGotTheMessage] = useState(null);
    const [gotTheTelMessage, setGotTheTelMessage] = useState(null);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMobile] = useState(/Mobi|Android|iPhone/i.test(navigator.userAgent));

    // FPV Link Logic
    const [primaryLink, setPrimaryLink] = useState(null);
    const secondaryLink = useRef(null);
    const [isFPVActive, setIsFPVActive] = useState(false);

    const [speed, setSpeed] = useState(20);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());
    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    const isArmedFromTel = gotTheTelMessage?.theTelMessage?.is_armable || false;

    useEffect(() => {
        if (!socket) return;
        socket.on("message", setGotTheMessage);
        socket.on("telemetryMessage", (tel) => {
            setGotTheTelMessage(tel);
            const incomingUrl = tel.theTelMessage?.cam_url;
            if (incomingUrl && incomingUrl !== secondaryLink.current) {
                secondaryLink.current = incomingUrl;
                setPrimaryLink(incomingUrl);
                setIsFPVActive(false); // Reset activation when a new link arrives
            }
        });
        return () => { socket.off("message"); socket.off("telemetryMessage"); };
    }, [socket]);

    // Game Loop (10Hz)
    useEffect(() => {
        if (!socket) return;
        let interval = setInterval(() => {
            const finalCommands = new Set(activeKeys.current);
            leftJoyDirs.current.forEach(c => finalCommands.add(c));
            rightJoyDirs.current.forEach(c => finalCommands.add(c));
            socket.emit("user-message", { commands: Array.from(finalCommands), speed });
        }, 100);
        return () => clearInterval(interval);
    }, [socket, speed]);

    const handleForceDisarm = () => {
        socket?.emit('user-message', { commands: ["force_disarm"], speed });
    };

    // --- BYPASS CLOUDFLARE BLOCK ---
    const activateFPV = () => {
        window.open(primaryLink, '_blank');
        setIsFPVActive(true);
    };

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative">

            {/* LAYER 0: FPV BACKGROUND */}
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#050a05]">
                {primaryLink ? (
                    <img 
                        src={primaryLink} 
                        alt="Drone FPV" 
                        className="w-full h-full object-cover opacity-80"
                        key={primaryLink} // Forces re-render on new link
                    />
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Circle className="size-12 text-emerald-500 animate-ping opacity-20" />
                        <p className="text-emerald-500/40 font-black tracking-widest text-sm">WAITING FOR LINK...</p>
                    </div>
                )}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
            </div>

            {/* LAYER 10: UI HUD */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
                <header className="w-full py-2 flex justify-center items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm">Panda Console</h1>
                    
                    {/* ACTIVATION BUTTON (Only shows when link exists but needs click) */}
                    {primaryLink && !isFPVActive && (
                        <button 
                            onClick={activateFPV}
                            className="absolute left-6 flex items-center gap-2 px-3 py-1 bg-emerald-500 text-black rounded-full text-[9px] font-bold animate-bounce shadow-lg"
                        >
                            <ExternalLink size={12} /> ACTIVATE FPV
                        </button>
                    )}

                    <div className="absolute right-6 flex items-center gap-2">
                        <div className={`size-3 rounded-full ${isArmedFromTel ? "bg-emerald-500 animate-pulse" : "bg-red-600 animate-pulse"}`} />
                    </div>
                </header>

                {/* SPEED SIDEBAR */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-50 pointer-events-auto">
                    <span className="text-[10px] text-[#2dd4bf] font-bold font-mono">{speed}%</span>
                    <div className="relative w-8 h-48 bg-black/60 border border-white/10 rounded-full flex flex-col-reverse p-1">
                        <input type="range" min="20" max="100" step="10" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                        <div className="w-full bg-gradient-to-t from-emerald-600 to-[#2dd4bf] rounded-full transition-all" style={{ height: `${speed}%` }} />
                    </div>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-4 pb-4 lg:px-12 lg:pb-12">
                    <div className="flex-1 flex justify-start pointer-events-auto">
                        <Joystick leftSide={true} onMove={(dx, dy, r) => {
                            const threshold = r * 0.3;
                            const newDirs = new Set();
                            if (dy < -threshold) newDirs.add("forward");
                            if (dy > threshold) newDirs.add("backward");
                            if (dx < -threshold) newDirs.add("left");
                            if (dx > threshold) newDirs.add("right");
                            leftJoyDirs.current = newDirs;
                        }} />
                    </div>

                    <div className="flex flex-row items-center gap-4 lg:gap-10 mb-4 shrink-0 pointer-events-auto">
                        <div className="flex flex-col gap-3 w-32 lg:w-80">
                            <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-2 rounded-xl shadow-2xl'>
                                <div className="text-center mb-2 border-b border-white/5 pb-1">
                                    <p className={`text-[10px] font-black uppercase ${isArmedFromTel ? "text-emerald-400" : "text-red-500 animate-pulse"}`}>
                                        {gotTheTelMessage?.theTelMessage?.status_msg || "CONNECTING..."}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 text-center text-[#2dd4bf] font-mono text-[9px] lg:text-[14px]">
                                    <div><p className="text-gray-500 text-[6px]">X</p>{gotTheTelMessage?.theTelMessage?.x?.toFixed(2) || "0.00"}</div>
                                    <div><p className="text-gray-500 text-[7px]">Y</p>{gotTheTelMessage?.theTelMessage?.y?.toFixed(2) || "0.00"}</div>
                                    <div><p className="text-gray-500 text-[6px]">θ</p>{gotTheTelMessage?.theTelMessage?.theta?.toFixed(2) || "0.00"}</div>
                                </div>
                            </div>
                            <button onClick={handleForceDisarm} className="w-full py-2 bg-red-600/20 border border-red-500/50 rounded-xl text-red-500 font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all">FORCE KILL</button>
                        </div>

                        <div ref={sliderRef}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={(e) => {
                                if (!isDraggingSlider || !sliderRef.current) return;
                                const rect = sliderRef.current.getBoundingClientRect();
                                let dy = e.clientY - (rect.top + rect.height / 2);
                                const maxRange = rect.height / 2 - 10;
                                dy = Math.max(-maxRange, Math.min(maxRange, dy));
                                setYPos(dy);
                                if (!hasTriggeredAction.current) {
                                    if (dy < -maxRange * 0.8) { socket?.emit('user-message', { commands: ["arm"], speed }); hasTriggeredAction.current = true; }
                                    else if (dy > maxRange * 0.8) { socket?.emit('user-message', { commands: ["land"], speed }); hasTriggeredAction.current = true; }
                                }
                            }}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-12 h-36 lg:w-16 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm"
                        >
                            <div className="absolute top-2 text-[6px] font-bold text-emerald-500 opacity-40">ARM</div>
                            <div className="absolute bottom-2 text-[6px] font-bold text-orange-500 opacity-40">LAND</div>
                            <div className="absolute w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center shadow-2xl transition-all" style={{ transform: `translateY(${yPos}px)`, borderRadius: '50%', background: isArmedFromTel ? "#10b981" : "#06b6d4" }}>
                                <Power size={18} />
                            </div>
                        </div>
                    </div>

                    <div className="flex-1 flex justify-end pointer-events-auto">
                        <Joystick leftSide={false} onMove={(dx, dy, r) => {
                            const threshold = r * 0.3;
                            const newDirs = new Set();
                            if (dy < -threshold) newDirs.add("up");
                            if (dy > threshold) newDirs.add("down");
                            if (dx < -threshold) newDirs.add("rotate_left");
                            if (dx > threshold) newDirs.add("rotate_right");
                            rightJoyDirs.current = newDirs;
                        }} />
                    </div>
                </main>
            </div>
        </div>
    );
};