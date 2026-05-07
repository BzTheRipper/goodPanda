import React, { useState, useEffect, useRef, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import { Power, Circle, ShieldAlert, ExternalLink } from "lucide-react";

const Joystick = memo(({ onMove }) => {
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
        const max = rect.width / 2;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > max) { dx *= max / dist; dy *= max / dist; }
        stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;
        onMove(dx, dy, max);
    };

    const handleRelease = () => {
        setIsInteracting(false);
        if (stickRef.current) stickRef.current.style.transform = `translate(0px, 0px)`;
        onMove(0, 0, 1);
    };

    return (
        <div className="relative flex flex-col items-center pointer-events-auto">
            <div ref={baseRef} className="w-24 h-24 lg:w-40 lg:h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 flex items-center justify-center backdrop-blur-sm touch-none"
                onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsInteracting(true); }}
                onPointerMove={handlePointerMove} onPointerUp={handleRelease} onPointerCancel={handleRelease}>
                <div ref={stickRef} className="w-8 h-8 lg:w-14 lg:h-14 rounded-full bg-[#2dd4bf] shadow-2xl" />
            </div>
        </div>
    );
});

export const MessagetestPage = () => {
    const { socket } = useAuthState();
    const [gotTheTelMessage, setGotTheTelMessage] = useState(null);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
    const [primaryLink, setPrimaryLink] = useState(null);
    const [isFPVActive, setIsFPVActive] = useState(false);
    const [speed, setSpeed] = useState(20);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());
    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    useEffect(() => {
        if (!socket) return;
        socket.on("telemetryMessage", (tel) => {
            setGotTheTelMessage(tel);
            if (tel.theTelMessage?.cam_url && tel.theTelMessage.cam_url !== primaryLink) {
                setPrimaryLink(tel.theTelMessage.cam_url);
                setIsFPVActive(false);
            }
        });
        return () => socket.off("telemetryMessage");
    }, [socket, primaryLink]);

    useEffect(() => {
        const interval = setInterval(() => {
            const combined = new Set([...Array.from(activeKeys.current), ...Array.from(leftJoyDirs.current), ...Array.from(rightJoyDirs.current)]);
            if (socket) socket.emit("user-message", { commands: Array.from(combined), speed });
        }, 100);
        return () => clearInterval(interval);
    }, [socket, speed]);

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative">
            {/* LAYER 0: FPV IFRAME */}
            <div className="absolute inset-0 z-0 bg-[#050a05]">
                {primaryLink ? (
                    <iframe src={primaryLink} className="w-full h-full border-none opacity-90" title="FPV" key={primaryLink} />
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-emerald-500/40 text-[10px] uppercase tracking-widest animate-pulse">Waiting for Link...</div>
                )}
            </div>

            {/* LAYER 10: UI */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
                <header className="w-full py-1 lg:py-2 flex justify-center items-center bg-black/40 backdrop-blur-md border-b border-white/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[9px] lg:text-sm">Panda Console</h1>
                    {primaryLink && !isFPVActive && (
                        <button onClick={() => { window.open(primaryLink, '_blank'); setIsFPVActive(true); }} className="absolute left-4 px-2 py-0.5 bg-emerald-500 text-black rounded-full text-[8px] font-bold animate-bounce">ACTIVATE FPV</button>
                    )}
                    <div className="absolute right-4 size-2.5 rounded-full bg-red-600 shadow-red-500" style={{ backgroundColor: gotTheTelMessage?.theTelMessage?.is_armable ? '#10b981' : '#dc2626' }} />
                </header>

                <div className="absolute right-2 top-1/2 -translate-y-1/2 flex flex-col items-center gap-1 z-50 pointer-events-auto">
                    <span className="text-[8px] text-[#2dd4bf] font-mono">{speed}%</span>
                    <div className="relative w-6 h-32 lg:w-10 bg-black/60 border border-white/10 rounded-full flex flex-col-reverse p-0.5">
                        <input type="range" min="20" max="100" step="10" value={speed} onChange={(e) => setSpeed(parseInt(e.target.value))} className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none" style={{ WebkitAppearance: 'slider-vertical' }} />
                        <div className="w-full bg-emerald-500 rounded-full transition-all" style={{ height: `${speed}%` }} />
                    </div>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-2 pb-2 lg:px-12 lg:pb-12">
                    <div className="w-1/3 flex justify-start pointer-events-auto">
                        <Joystick onMove={(dx, dy, r) => {
                            const t = r * 0.3; const d = new Set();
                            if (dy < -t) d.add("forward"); if (dy > t) d.add("backward");
                            if (dx < -t) d.add("left"); if (dx > t) d.add("right");
                            leftJoyDirs.current = d;
                        }} />
                    </div>

                    <div className="flex-1 flex flex-col items-center gap-2 mb-2 pointer-events-auto max-w-[120px] lg:max-w-xs">
                        <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-1 rounded-lg w-full'>
                            <p className="text-center text-[8px] lg:text-[10px] text-white font-mono uppercase">{gotTheTelMessage?.theTelMessage?.status_msg || "OFFLINE"}</p>
                            <div className="grid grid-cols-3 text-center text-[#2dd4bf] font-mono text-[7px] lg:text-[13px] border-t border-white/5 mt-1">
                                <div><p className="text-gray-500 text-[5px]">X</p>{gotTheTelMessage?.theTelMessage?.x?.toFixed(1) || "0.0"}</div>
                                <div><p className="text-gray-500 text-[5px]">Y</p>{gotTheTelMessage?.theTelMessage?.y?.toFixed(1) || "0.0"}</div>
                                <div><p className="text-gray-500 text-[5px]">θ</p>{gotTheTelMessage?.theTelMessage?.theta?.toFixed(1) || "0.0"}</div>
                            </div>
                        </div>
                        <button onClick={() => socket?.emit('user-message', { commands: ["force_disarm"], speed })} className="w-full py-1 bg-red-600/20 border border-red-500/40 rounded-lg text-red-500 text-[8px] lg:text-[10px] font-black uppercase">FORCE KILL</button>
                        <div ref={sliderRef}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={(e) => {
                                if (!isDraggingSlider || !sliderRef.current) return;
                                const rect = sliderRef.current.getBoundingClientRect();
                                let dy = (e.touches ? e.touches[0].clientY : e.clientY) - (rect.top + rect.height / 2);
                                const max = rect.height / 2 - 10;
                                dy = Math.max(-max, Math.min(max, dy)); setYPos(dy);
                                if (!hasTriggeredAction.current) {
                                    if (dy < -max * 0.8) { socket?.emit('user-message', { commands: ["arm"], speed }); hasTriggeredAction.current = true; }
                                    else if (dy > max * 0.8) { socket?.emit('user-message', { commands: ["land"], speed }); hasTriggeredAction.current = true; }
                                }
                            }}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-10 h-28 lg:w-16 bg-black/60 rounded-2xl border border-white/10 flex items-center justify-center backdrop-blur-sm"
                        >
                            <div className="absolute top-1 text-[5px] text-emerald-500 opacity-40">ARM</div>
                            <div className="absolute bottom-1 text-[5px] text-orange-500 opacity-40">LAND</div>
                            <div className="absolute w-8 h-8 rounded-full shadow-2xl transition-all" style={{ transform: `translateY(${yPos}px)`, background: gotTheTelMessage?.theTelMessage?.is_armable ? "#10b981" : "#06b6d4" }} />
                        </div>
                    </div>

                    <div className="w-1/3 flex justify-end pr-10 lg:pr-0 pointer-events-auto">
                        <Joystick onMove={(dx, dy, r) => {
                            const t = r * 0.3; const d = new Set();
                            if (dy < -t) d.add("up"); if (dy > t) d.add("down");
                            if (dx < -t) d.add("rotate_left"); if (dx > t) d.add("rotate_right");
                            rightJoyDirs.current = d;
                        }} />
                    </div>
                </main>
            </div>
        </div>
    );
};