import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, ArrowDownToLine, Circle
} from "lucide-react";

// --- OPTIMIZED JOYSTICK COMPONENT ---
// Memoized to prevent re-renders when the parent receives socket data
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

        // DIRECT DOM UPDATE: Bypass React state for the visual movement
        // This ensures 60FPS movement even if the rest of the app is busy
        stickRef.current.style.transform = `translate(${dx}px, ${dy}px)`;

        // Pass coordinates back to parent logic
        onMove(dx, dy, maxRadius);
    };

    const handleRelease = () => {
        setIsInteracting(false);
        if (stickRef.current) {
            stickRef.current.style.transform = `translate(0px, 0px)`;
        }
        onMove(0, 0, 1); // Reset logic to neutral
    };

    return (
        <div className="relative flex flex-col items-center">
            <div
                ref={baseRef}
                className="w-28 h-28 lg:w-40 lg:h-40 rounded-full bg-emerald-500/5 border-2 border-emerald-500/10 relative flex items-center justify-center shadow-inner touch-none"
                onPointerDown={(e) => {
                    e.currentTarget.setPointerCapture(e.pointerId);
                    setIsInteracting(true);
                }}
                onPointerMove={handlePointerMove}
                onPointerUp={handleRelease}
                onPointerCancel={handleRelease}
            >
                <div className="absolute inset-0 pointer-events-none opacity-10 flex items-center justify-center">
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

export const PerfectMessageTestPageForMobileJoystick = () => {
    const { socket } = useAuthState();
    const [gotTheMessage, setGotTheMessage] = useState(null);
    const [gotTheTelMessage, setGotTheTelMessage] = useState(null);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMobile] = useState(/Mobi|Android|iPhone/i.test(navigator.userAgent));

    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());

    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    const isArmedFromTel = gotTheTelMessage?.theTelMessage?.is_armed || false;

    // --- SOCKETS ---
    useEffect(() => {
        if (!socket) return;
        const handleMessage = (msg) => setGotTheMessage(msg);
        const handleTelemetry = (tel) => setGotTheTelMessage(tel);

        socket.on("message", handleMessage);
        socket.on("telemetryMessage", handleTelemetry);

        return () => {
            socket.off("message", handleMessage);
            socket.off("telemetryMessage", handleTelemetry);
        };
    }, [socket]);

    // --- KEYBOARD ---
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
            activeKeys.current.add(key);
            if (key === 'k' && socket) socket.emit('user-message', { commands: ["arm"] });
            if (key === 'l' && socket) socket.emit('user-message', { commands: ["land"] });
        };
        const handleKeyUp = (e) => activeKeys.current.delete(e.key.toLowerCase());

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, [socket]);

    // --- JOYSTICK LOGIC HANDLERS ---
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

    // --- GAME LOOP ---
    useEffect(() => {
        if (!socket) return;
        let animationId;
        let lastTime = 0;

        const loop = (time) => {
            if (time - lastTime > 100) { // Send at 10Hz to prevent socket flooding
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
                
                // adding joystick commands from mobile 
                leftJoyDirs.current.forEach(cmd => finalCommands.add(cmd));
                rightJoyDirs.current.forEach(cmd => finalCommands.add(cmd));

                console.log("Sending Commands : ", Array.from(finalCommands));

                if (finalCommands.size >= 0) {
                    socket.emit("user-message", { commands: Array.from(finalCommands) });
                }
            }
            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationId);
    }, [socket]);

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
                socket?.emit('user-message', { commands: ["arm"] });
                if (navigator.vibrate) navigator.vibrate(50);
                hasTriggeredAction.current = true;
            } else if (dy > threshold) {
                socket?.emit('user-message', { commands: ["land"] });
                if (navigator.vibrate) navigator.vibrate(50);
                hasTriggeredAction.current = true;
            }
        }
    };

    // --- FULLSCREEN & ORIENTATION ---
    const enterLandscapeConsole = async () => {
        try {
            const element = document.documentElement;
            if (element.requestFullscreen) await element.requestFullscreen();
            if (screen.orientation?.lock) await screen.orientation.lock('landscape');
            setIsFullScreen(true);
        } catch (err) { console.error(err); }
    };

    useEffect(() => {
        const check = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
            setIsFullScreen(!!document.fullscreenElement);
        };
        window.addEventListener('resize', check);
        document.addEventListener('fullscreenchange', check);
        return () => {
            window.removeEventListener('resize', check);
            document.removeEventListener('fullscreenchange', check);
        };
    }, []);

    return (
        <div className="h-[100dvh] w-full bg-[#050a05] flex flex-col items-center touch-none overflow-hidden select-none">
            
            {/* ROTATE OVERLAY */}
            {isMobile && (!isLandscape || !isFullScreen) && (
                <div className="fixed inset-0 z-[100] bg-[#050a05] flex flex-col items-center justify-center text-center p-6 text-white font-bold">
                    <div className="w-16 h-16 border-4 border-emerald-500 rounded-xl animate-bounce flex items-center justify-center mb-4 text-emerald-500 text-3xl">🔄</div>
                    <p className="mb-4 uppercase tracking-widest">{!isLandscape ? "Rotate Device to Fly" : "Go Fullscreen to Fly"}</p>
                    <button onClick={enterLandscapeConsole} className="bg-[#2dd4bf] text-black font-bold py-2 px-6 rounded-full text-sm shadow-[0_0_15px_rgba(45,212,191,0.5)]">
                        TAP TO START
                    </button>
                </div>
            )}

            <header className="w-full py-2 flex justify-center items-center bg-[#2dd4bf]/5 border-b border-emerald-500/10">
                <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow">Panda Console</h1>
            </header>

            <main className="flex-1 w-full flex flex-row items-end justify-between px-4 pb-4 lg:px-12 lg:pb-12">
                <div className="flex-1 flex justify-start">
                    <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                        <p className="text-[8px] lg:text-[10px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic">Movement</p>
                        <Joystick leftSide={true} onMove={updateLeftJoystick} />
                    </div>
                </div>

                <div className="flex flex-row items-center gap-4 lg:gap-10 mb-4 shrink-0 z-10 w-fit">
                    <div className="flex flex-col gap-3 w-32 lg:w-80">
                        <div className='bg-emerald-500/5 border border-emerald-500/20 p-2 rounded-xl min-h-[45px] lg:min-h-[60px] flex items-center justify-center text-center overflow-hidden'>
                            <p className="text-[9px] lg:text-[14px] leading-tight text-white font-mono tracking-tighter">
                                {gotTheMessage ? (
                                    <><span className="text-[#2dd4bf] font-bold">{gotTheMessage.name}</span>: {JSON.stringify(gotTheMessage.theMessage)}</>
                                ) : ">> SYSTEM_READY"}
                            </p>
                        </div>
                        <div className='bg-black/60 border border-emerald-500/10 p-2 rounded-xl shadow-lg grid grid-cols-3 text-center text-emerald-400 font-mono text-[8px] lg:text-[12px]'>
                            <div><p className="text-gray-600 text-[6px]">X</p>0.00</div>
                            <div><p className="text-gray-600 text-[7px]">Y</p>0.00</div>
                            <div><p className="text-gray-600 text-[6px]">θ</p>0.00</div>
                        </div>
                    </div>

                    {/* ACTION SLIDER */}
                    <div className="flex flex-col items-center gap-1">
                        <div
                            ref={sliderRef}
                            onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                            onPointerMove={handleSliderMove}
                            onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                            onPointerCancel={() => { setIsDraggingSlider(false); setYPos(0); }}
                            className="relative w-12 h-36 lg:w-16 lg:h-56 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center touch-none"
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
                </div>

                <div className="flex-1 flex justify-end">
                    <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                        <p className="text-[8px] lg:text-[10px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic">Alt & Yaw</p>
                        <Joystick leftSide={false} onMove={updateRightJoystick} />
                    </div>
                </div>
            </main>

            <style dangerouslySetInnerHTML={{ __html: `.green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } * { -webkit-tap-highlight-color: transparent !important; touch-action: none !important; }` }} />
        </div>
    );
};