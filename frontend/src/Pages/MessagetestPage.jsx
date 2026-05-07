import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, 
    ArrowDownToLine, Circle, ShieldAlert, ExternalLink 
} from "lucide-react";

// --- JOYSTICK COMPONENT (Responsive Sizing) ---
const Joystick = memo(({ leftSide = true, onMove }) => {
    const baseRef = useRef(null);
    const stickRef = useRef(null);
    const [isInteracting, setIsInteracting] = useState(false);

    const handlePointerMove = (e) => {
        if (!isInteracting || !baseRef.current || !stickRef.current) return;
        const rect = baseRef.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;
        let dx = clientX - centerX;
        let dy = clientY - centerY;
        const maxRadius = rect.width / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > maxRadius) { dx *= maxRadius / dist; dy *= maxRadius / dist; }
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
                className="w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 relative flex items-center justify-center shadow-2xl backdrop-blur-sm touch-none"
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

    const [primaryLink, setPrimaryLink] = useState(null);
    const secondaryLink = useRef(null);
    const [isFPVActive, setIsFPVActive] = useState(false);

    const [speed, setSpeed] = useState(20);
    const [visualCmds, setVisualCommands] = useState([]); // Command shower state
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
                setIsFPVActive(false);
            }
        });
        return () => { socket.off("message"); socket.off("telemetryMessage"); };
    }, [socket, primaryLink]);

    useEffect(() => {
        if (!socket) return;
        let interval = setInterval(() => {
            const combined = new Set([...Array.from(activeKeys.current), ...Array.from(leftJoyDirs.current), ...Array.from(rightJoyDirs.current)]);
            const cmdArray = Array.from(combined);
            setVisualCommands(cmdArray); // Show commands in HUD
            socket.emit("user-message", { commands: cmdArray, speed });
        }, 100);
        return () => clearInterval(interval);
    }, [socket, speed]);

    useEffect(() => {
        const keyMap = {'w':'forward','s':'backward','a':'left','d':'right','arrowup':'up','arrowdown':'down','arrowleft':'rotate_left','arrowright':'rotate_right','k':'arm','l':'land'};
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (keyMap[key]) { e.preventDefault(); activeKeys.current.add(keyMap[key]); }
        };
        const handleKeyUp = (e) => {
            const key = e.key.toLowerCase();
            if (keyMap[key]) activeKeys.current.delete(keyMap[key]);
        };
        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => { window.removeEventListener("keydown", handleKeyDown); window.removeEventListener("keyup", handleKeyUp); };
    }, []);

    const handleForceDisarm = () => socket?.emit('user-message', { commands: ["force_disarm"], speed });
    
    const activateFPV = () => {
        window.open(primaryLink, '_blank');
        setIsFPVActive(true);
    };

    const enterLandscapeConsole = async () => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) await element.requestFullscreen();
            if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            setIsFullScreen(true);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const check = () => { setIsLandscape(window.innerWidth > window.innerHeight); setIsFullScreen(!!document.fullscreenElement); };
        window.addEventListener('resize', check);
        document.addEventListener('fullscreenchange', check);
        return () => { window.removeEventListener('resize', check); document.removeEventListener('fullscreenchange', check); };
    }, []);

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative">

            {/* LAYER 0: FPV BACKGROUND (Fixed with Iframe) */}
            <div className="absolute inset-0 z-0 bg-[#050a05] w-full h-full overflow-hidden flex items-center justify-center">
                {primaryLink ? (
                    <iframe 
                        src={primaryLink} 
                        className="w-full h-full border-none opacity-90 block" 
                        allow="autoplay; fullscreen"
                        sandbox="allow-forms allow-scripts allow-same-origin allow-popups"
                        title="FPV Feed"
                        key={primaryLink}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Circle className="size-12 text-emerald-500 animate-ping opacity-20" />
                        <p className="text-emerald-500/40 font-black tracking-widest text-[10px] uppercase">Connecting FPV...</p>
                    </div>
                )}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_150px_rgba(0,0,0,0.9)]" />
            </div>

            {/* COMMAND LINE SHOWER */}
            <div className="absolute top-12 lg:top-16 left-1/2 -translate-x-1/2 z-20 flex gap-2 pointer-events-none">
                {visualCmds.length > 0 ? visualCmds.map((c, i) => (
                    <span key={i} className="px-2 py-0.5 bg-black/60 border border-emerald-500/40 text-[#2dd4bf] font-mono text-[8px] lg:text-[10px] uppercase rounded animate-pulse shadow-lg">
                        {c}
                    </span>
                )) : <span className="text-white/5 font-mono text-[8px] uppercase">System Idle</span>}
            </div>

            {/* LAYER 10: UI */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
                
                {isMobile && (!isLandscape || !isFullScreen) && (
                    <div className="fixed inset-0 z-[100] bg-[#050a05] flex flex-col items-center justify-center text-center p-6 text-white font-bold pointer-events-auto">
                        <p className="mb-4 uppercase tracking-widest text-sm">Rotate & Fullscreen to Fly</p>
                        <button onClick={enterLandscapeConsole} className="bg-[#2dd4bf] text-black font-bold py-2 px-6 rounded-full text-sm">START CONSOLE</button>
                    </div>
                )}

                <header className="w-full py-1 lg:py-2 flex justify-center items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[9px] lg:text-sm green-glow">Panda Console</h1>
                    {primaryLink && !isFPVActive && (
                        <button onClick={activateFPV} className="absolute left-4 flex items-center gap-1 px-2 py-0.5 bg-emerald-500 text-black rounded-full text-[8px] font-bold animate-bounce shadow-lg">
                            <ExternalLink size={10} /> ACTIVATE FPV
                        </button>
                    )}
                    <div className="absolute right-4 flex items-center gap-2">
                        <div className={`size-2.5 rounded-full ${isArmedFromTel ? "bg-emerald-500 animate-pulse" : "bg-red-600 animate-pulse"}`} />
                    </div>
                </header>

                <div className="absolute right-2 lg:right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 lg:gap-2 z-50 pointer-events-auto">
                    <span className="text-[8px] lg:text-[10px] text-[#2dd4bf] font-bold font-mono">{speed}%</span>
                    <div className="relative w-6 h-32 lg:w-10 lg:h-64 bg-black/60 border border-white/10 rounded-full flex flex-col-reverse p-0.5 overflow-hidden">
                        <input type="range" min="20" max="100" step="10" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                        <div className="w-full bg-gradient-to-t from-emerald-600 to-[#2dd4bf] rounded-full transition-all duration-150" style={{ height: `${speed}%` }} />
                    </div>
                    <p className="text-[7px] lg:text-[8px] text-gray-500 uppercase font-black vertical-text mt-1">Throttle</p>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12">
                    <div className="w-1/3 flex justify-start pointer-events-auto">
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-2 uppercase tracking-widest italic">Movement</p>
                            <Joystick onMove={(dx, dy, r) => {
                                const t = r * 0.3; const d = new Set();
                                if (dy < -t) d.add("forward"); if (dy > t) d.add("backward");
                                if (dx < -t) d.add("left"); if (dx > t) d.add("right");
                                leftJoyDirs.current = d;
                            }} />
                        </div>
                    </div>

                    {/* --- CENTER HUD & SLIDER: SIDE-BY-SIDE DESIGN PRESERVED --- */}
                    <div className="flex flex-row items-end gap-3 lg:gap-10 mb-2 lg:mb-4 pointer-events-auto">
                        
                        {/* 1. HUD & KILL BLOCK (LEFT) */}
                        <div className="flex flex-col gap-2 w-28 lg:w-80 justify-end">
                            <div className='bg-black/60 backdrop-blur-md border border-white/10 p-1.5 rounded-lg min-h-[35px] flex items-center justify-center text-center'>
                                <p className="text-[7px] lg:text-[10px] text-white font-mono leading-tight">
                                    {gotTheMessage ? <><span className="text-[#2dd4bf]">{gotTheMessage.name}</span>: {JSON.stringify(gotTheMessage.theMessage)}</> : ">> SYSTEM READY"}
                                </p>
                            </div>

                            <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-1.5 lg:p-2 rounded-xl shadow-2xl w-full'>
                                <div className="text-center mb-1 border-b border-white/5 pb-0.5">
                                    <p className={`text-[8px] lg:text-[10px] font-black uppercase ${isArmedFromTel ? "text-emerald-400" : "text-red-500"}`}>
                                        {gotTheTelMessage?.theTelMessage?.status_msg || "CONNECTING..."}
                                    </p>
                                </div>
                                <div className="grid grid-cols-3 text-center text-[#2dd4bf] font-mono text-[7px] lg:text-[13px]">
                                    <div><p className="text-gray-500 text-[5px]">X</p>{gotTheTelMessage?.theTelMessage?.x?.toFixed(1) || "0.0"}</div>
                                    <div><p className="text-gray-500 text-[5px]">Y</p>{gotTheTelMessage?.theTelMessage?.y?.toFixed(1) || "0.0"}</div>
                                    <div><p className="text-gray-500 text-[5px]">θ</p>{gotTheTelMessage?.theTelMessage?.theta?.toFixed(1) || "0.0"}</div>
                                </div>
                            </div>

                            <button onClick={handleForceDisarm} className="w-full py-1.5 bg-red-600/20 border border-red-500/40 rounded-lg text-red-500 font-black text-[8px] lg:text-[10px] uppercase active:scale-95 shadow-xl">FORCE KILL</button>
                        </div>

                        {/* 2. ARM/LAND SLIDER (RIGHT) */}
                        <div ref={sliderRef}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={(e) => {
                                if (!isDraggingSlider || !sliderRef.current) return;
                                const rect = sliderRef.current.getBoundingClientRect();
                                let dy = (e.touches ? e.touches[0].clientY : e.clientY) - (rect.top + rect.height / 2);
                                const maxRange = rect.height / 2 - 10;
                                dy = Math.max(-maxRange, Math.min(maxRange, dy)); setYPos(dy);
                                if (!hasTriggeredAction.current) {
                                    if (dy < -maxRange * 0.8) { socket?.emit('user-message', { commands: ["arm"], speed }); hasTriggeredAction.current = true; }
                                    else if (dy > maxRange * 0.8) { socket?.emit('user-message', { commands: ["land"], speed }); hasTriggeredAction.current = true; }
                                }
                            }}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-10 lg:w-14 h-32 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm shadow-xl"
                        >
                            <div className="absolute top-2 text-[5px] lg:text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                            <div className="absolute bottom-2 text-[5px] lg:text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                            <div className="w-full h-0.5 bg-white/10 absolute" />
                            <div className="absolute w-8 h-8 lg:w-12 lg:h-12 flex items-center justify-center shadow-2xl transition-all duration-150" style={{ transform: `translateY(${yPos}px)`, borderRadius: '50%', background: isArmedFromTel ? "#10b981" : "#06b6d4" }}>
                                <Power size={isMobile ? 14 : 18} />
                            </div>
                        </div>
                    </div>

                    {/* Right Joystick (Fixed merge issue with padding) */}
                    <div className="w-1/3 flex justify-end pr-10 lg:pr-0 pointer-events-auto">
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-2 uppercase tracking-widest italic">Alt / Yaw</p>
                            <Joystick leftSide={false} onMove={(dx, dy, r) => {
                                const t = r * 0.3; const d = new Set();
                                if (dy < -t) d.add("up"); if (dy > t) d.add("down");
                                if (dx < -t) d.add("rotate_left"); if (dx > t) d.add("rotate_right");
                                rightJoyDirs.current = d;
                            }} />
                        </div>
                    </div>
                </main>
            </div>
            <style dangerouslySetInnerHTML={{ __html: `* { -webkit-tap-highlight-color: transparent !important; touch-action: none !important; } .vertical-text { writing-mode: vertical-rl; }` }} />
        </div>
    );
};