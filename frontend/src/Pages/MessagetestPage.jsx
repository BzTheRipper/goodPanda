import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, 
    ArrowDownToLine, Circle, ShieldAlert 
} from "lucide-react";

// --- OPTIMIZED JOYSTICK COMPONENT ---
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
        if (stickRef.current) {
            stickRef.current.style.transform = `translate(0px, 0px)`;
        }
        onMove(0, 0, 1); 
    };

    return (
        <div className="relative flex flex-col items-center pointer-events-auto">
            <div
                ref={baseRef}
                className="w-28 h-28 lg:w-40 lg:h-40 rounded-full bg-emerald-500/10 border-2 border-emerald-500/30 relative flex items-center justify-center shadow-2xl backdrop-blur-sm touch-none"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsInteracting(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handleRelease}
                onPointerCancel={handleRelease}
            >
                <div className="absolute inset-0 pointer-events-none opacity-20 flex items-center justify-center">
                    <div className="w-full h-0.5 bg-emerald-500" />
                    <div className="h-full w-0.5 bg-emerald-500 absolute" />
                </div>

                <div
                    ref={stickRef}
                    className="w-10 h-10 lg:w-14 lg:h-14 rounded-full shadow-2xl flex items-center justify-center bg-[#2dd4bf] pointer-events-none will-change-transform"
                    style={{ transform: 'translate(0px, 0px)' }}
                >
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

    // --- FPV LINK LOGIC ---
    const [primaryLink, setPrimaryLink] = useState(null);
    const secondaryLink = useRef(null);

    // Speed and Command State
    const [speed, setSpeed] = useState(20);
    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());

    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    const isArmedFromTel = gotTheTelMessage?.theTelMessage?.is_armable || false;

    // --- SOCKET LISTENERS ---
    useEffect(() => {
        if (!socket) return;
        
        const handleMessage = (msg) => setGotTheMessage(msg);
        
        const handleTelemetry = (tel) => {
            setGotTheTelMessage(tel);
            
            // DYNAMIC FPV LINK SYNC
            const incomingUrl = tel.theTelMessage?.cam_url;
            if (incomingUrl && incomingUrl !== secondaryLink.current) {
                console.log("🔗 New FPV Link Received:", incomingUrl);
                secondaryLink.current = incomingUrl;
                setPrimaryLink(incomingUrl);
            }
        };

        socket.on("message", handleMessage);
        socket.on("telemetryMessage", handleTelemetry);

        return () => {
            socket.off("message", handleMessage);
            socket.off("telemetryMessage", handleTelemetry);
        };
    }, [socket]);

    // --- KEYBOARD CONTROL ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
            activeKeys.current.add(key);
            if (key === 'k' && socket) socket.emit('user-message', { commands: ["arm"], speed });
        };
        const handleKeyUp = (e) => activeKeys.current.delete(e.key.toLowerCase());

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [socket, speed]);

    // --- JOYSTICK HANDLERS ---
    const updateLeftJoystick = useCallback((dx, dy, maxRadius) => {
        const threshold = maxRadius * 0.3;
        const newDirs = new Set();
        if (dy < -threshold) newDirs.add("forward");
        if (dy > threshold) newDirs.add("backward");
        if (dx < -threshold) newDirs.add("left");
        if (dx > threshold) newDirs.add("right");
        leftJoyDirs.current = newDirs;
    }, []);

    const updateRightJoystick = useCallback((dx, dy, maxRadius) => {
        const threshold = maxRadius * 0.3;
        const newDirs = new Set();
        if (dy < -threshold) newDirs.add("up");
        if (dy > threshold) newDirs.add("down");
        if (dx < -threshold) newDirs.add("rotate_left");
        if (dx > threshold) newDirs.add("rotate_right");
        rightJoyDirs.current = newDirs;
    }, []);

    // --- MAIN GAME LOOP (10Hz) ---
    useEffect(() => {
        if (!socket) return;
        let animationId;
        let lastTime = 0;

        const loop = (time) => {
            if (time - lastTime > 100) { 
                lastTime = time;
                const finalCommands = new Set();
                const keys = activeKeys.current;

                if (keys.has("w")) finalCommands.add("forward");
                if (keys.has("s")) finalCommands.add("backward");
                if (keys.has("a")) finalCommands.add("left");
                if (keys.has("d")) finalCommands.add("right");
                if (keys.has("arrowup")) finalCommands.add("up");
                if (keys.has("arrowdown")) finalCommands.add("down");
                if (keys.has("arrowleft")) finalCommands.add("rotate_left");
                if (keys.has("arrowright")) finalCommands.add("rotate_right");

                leftJoyDirs.current.forEach(cmd => finalCommands.add(cmd));
                rightJoyDirs.current.forEach(cmd => finalCommands.add(cmd));

                socket.emit("user-message", { 
                    commands: Array.from(finalCommands),
                    speed: speed 
                });
            }
            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationId);
    }, [socket, speed]);

    // --- SLIDER LOGIC ---
    const handleSliderMove = (e) => {
        if (!isDraggingSlider || !sliderRef.current) return;
        const rect = sliderRef.current.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;
        let dy = e.clientY - centerY;
        const maxRange = rect.height / 2 - 10;
        if (dy < -maxRange) dy = -maxRange;
        if (dy > maxRange) dy = maxRange;
        setYPos(dy);

        const threshold = maxRange * 0.8;
        if (!hasTriggeredAction.current) {
            if (dy < -threshold) {
                socket?.emit('user-message', { commands: ["arm"], speed });
                hasTriggeredAction.current = true;
            } else if (dy > threshold) {
                socket?.emit('user-message', { commands: ["land"], speed });
                hasTriggeredAction.current = true;
            }
        }
    };

    const handleForceDisarm = () => {
        socket?.emit('user-message', { commands: ["force_disarm"], speed });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };

    const enterLandscapeConsole = async () => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) await element.requestFullscreen();
            if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            setIsFullScreen(true);
        } catch (err) { console.error(err); }
    };

    return (
        <div className="h-[100dvh] w-full bg-black flex flex-col items-center touch-none overflow-hidden select-none relative">

            {/* --- LAYER 0: FPV BACKGROUND --- */}
            <div className="absolute inset-0 z-0 flex items-center justify-center bg-[#050a05]">
                {primaryLink ? (
                    <img 
                        src={primaryLink} 
                        alt="Drone FPV Feed" 
                        className="w-full h-full object-cover opacity-80"
                        onError={() => setPrimaryLink(null)}
                    />
                ) : (
                    <div className="flex flex-col items-center gap-4">
                        <Circle className="size-12 text-emerald-500 animate-ping opacity-20" />
                        <p className="text-emerald-500/40 font-black tracking-widest text-sm uppercase">Waiting for FPV Link...</p>
                    </div>
                )}
                {/* HUD Vignette */}
                <div className="absolute inset-0 pointer-events-none shadow-[inset_0_0_200px_rgba(0,0,0,0.9)]" />
            </div>

            {/* --- LAYER 10: UI HUD OVERLAY --- */}
            <div className="absolute inset-0 z-10 flex flex-col pointer-events-none">
                
                {/* ROTATE OVERLAY */}
                {isMobile && (!isLandscape || !isFullScreen) && (
                    <div className="fixed inset-0 z-[100] bg-[#050a05] flex flex-col items-center justify-center text-center p-6 text-white font-bold pointer-events-auto">
                        <div className="w-16 h-16 border-4 border-emerald-500 rounded-xl animate-bounce flex items-center justify-center mb-4 text-emerald-500 text-3xl">🔄</div>
                        <p className="mb-4 uppercase tracking-widest">Rotate & Fullscreen to Fly</p>
                        <button onClick={enterLandscapeConsole} className="bg-[#2dd4bf] text-black font-bold py-2 px-6 rounded-full text-sm">START CONSOLE</button>
                    </div>
                )}

                <header className="w-full py-2 flex justify-center items-center bg-black/40 backdrop-blur-md border-b border-emerald-500/10 pointer-events-auto">
                    <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow">Panda Console</h1>
                    
                    {/* STATUS LED - Top Right */}
                    <div className="absolute right-6 flex items-center gap-2">
                        <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter">
                            {isArmedFromTel ? "System Active" : "System Safe"}
                        </span>
                        <div className={`size-3 rounded-full border border-white/10 shadow-lg ${
                            isArmedFromTel ? "bg-emerald-500 animate-pulse shadow-emerald-500/50" : "bg-red-600 animate-pulse shadow-red-500/50"
                        }`} />
                    </div>
                </header>

                {/* SPEED CONTROL SIDEBAR - Far Right */}
                <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col items-center gap-2 z-50 pointer-events-auto">
                    <span className="text-[10px] text-[#2dd4bf] font-bold font-mono">{speed}%</span>
                    <div className="relative w-8 h-48 lg:h-64 bg-black/60 border border-white/10 rounded-full flex flex-col-reverse p-1 overflow-hidden">
                        <input 
                            type="range" min="20" max="100" step="10" value={speed} 
                            onChange={(e) => setSpeed(parseInt(e.target.value))}
                            className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none"
                            style={{ WebkitAppearance: 'slider-vertical' }}
                        />
                        <div 
                            className="w-full bg-gradient-to-t from-emerald-600 to-[#2dd4bf] rounded-full transition-all duration-150" 
                            style={{ height: `${speed}%` }}
                        />
                    </div>
                    <p className="text-[8px] text-gray-500 uppercase font-black vertical-text mt-1">Throttle</p>
                </div>

                <main className="flex-1 w-full flex flex-row items-end justify-between px-4 pb-4 lg:px-12 lg:pb-12">
                    {/* Left Side: Movement */}
                    <div className="flex-1 flex justify-start pointer-events-auto">
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic">Direction</p>
                            <Joystick leftSide={true} onMove={updateLeftJoystick} />
                        </div>
                    </div>

                    {/* Center HUD & Buttons */}
                    <div className="flex flex-row items-center gap-4 lg:gap-10 mb-4 shrink-0 z-10 w-fit pointer-events-auto">
                        <div className="flex flex-col gap-3 w-32 lg:w-80">
                            <div className='bg-black/60 backdrop-blur-md border border-white/10 p-2 rounded-xl min-h-[40px] flex items-center justify-center text-center'>
                                <p className="text-[9px] text-white font-mono leading-none">
                                    {gotTheMessage ? (
                                        <><span className="text-[#2dd4bf]">{gotTheMessage.name}</span>: {JSON.stringify(gotTheMessage.theMessage)}</>
                                    ) : ">> SYSTEM READY"}
                                </p>
                            </div>

                            <div className='bg-black/80 backdrop-blur-lg border border-emerald-500/20 p-2 rounded-xl shadow-2xl w-full'>
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

                            {/* EMERGENCY DISARM */}
                            <button 
                                onClick={handleForceDisarm}
                                className="w-full py-2 bg-red-600/20 border border-red-500/50 rounded-xl flex items-center justify-center gap-2 text-red-500 font-black text-[10px] uppercase hover:bg-red-600 hover:text-white transition-all active:scale-95 shadow-2xl"
                            >
                                <ShieldAlert size={14} />
                                FORCE KILL
                            </button>
                        </div>

                        {/* SLIDER (ARM/LAND) */}
                        <div
                            ref={sliderRef}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={handleSliderMove}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-12 h-36 lg:w-16 lg:h-56 bg-black/60 rounded-3xl border border-white/10 flex items-center justify-center backdrop-blur-sm"
                        >
                            <div className="absolute top-2 text-[6px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                            <div className="absolute bottom-2 text-[6px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                            <div className="w-full h-0.5 bg-white/10 absolute" />
                            <div
                                className="absolute w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center shadow-2xl transition-all duration-150"
                                style={{
                                    transform: `translateY(${yPos}px)`,
                                    borderRadius: (isArmedFromTel || yPos < -15) ? "8px" : "50%",
                                    background: (isArmedFromTel || yPos < -15) ? "#10b981" : (yPos > 15 ? "#f97316" : "#06b6d4")
                                }}
                            >
                                {isArmedFromTel ? <Power size={18} /> : <ArrowDownToLine size={18} />}
                            </div>
                        </div>
                    </div>

                    {/* Right Side: Alt/Yaw */}
                    <div className="flex-1 flex justify-end pointer-events-auto">
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic">Altitude / Yaw</p>
                            <Joystick leftSide={false} onMove={updateRightJoystick} />
                        </div>
                    </div>
                </main>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `
                .green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } 
                .vertical-text { writing-mode: vertical-rl; text-orientation: mixed; }
                input[type=range] { writing-mode: bt-lr; -webkit-appearance: slider-vertical; }
            ` }} />
        </div>
    );
};