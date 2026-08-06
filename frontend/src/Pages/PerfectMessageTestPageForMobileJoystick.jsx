import React, { useState, useEffect, useRef, useCallback, memo } from 'react';
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, ArrowDownToLine, Circle, AlertOctagon
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
        <div className="relative flex flex-col items-center select-none touch-none">
            {/* Responsive Size: w-28 on mobile, up to w-48 on large monitors */}
            <div
                ref={baseRef}
                className="w-[25vh] h-[25vh] min-w-[110px] min-h-[110px] max-w-[220px] max-h-[220px] rounded-full bg-emerald-500/5 border-2 border-emerald-500/10 relative flex items-center justify-center shadow-inner"
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
                    className="w-[35%] h-[35%] rounded-full shadow-2xl flex items-center justify-center bg-[#2dd4bf] pointer-events-none will-change-transform"
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
    const [altitude, setAltitude] = useState(0);
    const altRef = useRef(0);

    const activeKeys = useRef(new Set());
    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());

    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    const isArmedFromTel = gotTheTelMessage?.theTelMessage?.is_armed || false;

    // --- SOCKET LOGIC ---
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

    // --- KEYBOARD CONTROLS ---
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

    // --- LOOP ---
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

                const commandArray = Array.from(finalCommands);
                if (finalCommands.size >= 0) {
                    socket.emit("user-message", {
                        commands: commandArray,
                        altitude: altRef.current
                    });
                }
            }
            animationId = requestAnimationFrame(loop);
        };
        animationId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(animationId);
    }, [socket]);

    const handleForceKill = () => {
        if (!socket) return;
        socket.emit("user-message", { commands: ["force_disarm"] });
        if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    };

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
                    <AlertOctagon size={48} className="text-emerald-500 mb-4 animate-pulse" />
                    <p className="mb-4 uppercase tracking-[0.3em] text-xs">Landscape Mode Required</p>
                    <button onClick={enterLandscapeConsole} className="bg-[#2dd4bf] text-black font-bold py-3 px-8 rounded-full text-xs shadow-lg">
                        START CONSOLE
                    </button>
                </div>
            )}

            {/* HEADER */}
            <header className="w-full py-[1.5vh] flex justify-center items-center bg-emerald-500/5 border-b border-emerald-500/10 shrink-0">
                <h1 className="text-emerald-400 font-black tracking-[0.5em] uppercase text-[min(2.5vw,14px)] green-glow">Panda Console</h1>
            </header>

            {/* EMERGENCY KILL - Centered vertically between Header and Main */}
            <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0">
                <div className="flex flex-col items-center group cursor-pointer" onPointerDown={handleForceKill}>
                    <div className="relative w-[15vh] h-[15vh] max-w-[120px] max-h-[120px] rounded-full border-4 border-red-500/50 bg-black flex flex-col items-center justify-center shadow-[0_0_30px_rgba(239,68,68,0.2)] active:scale-95 transition-transform overflow-hidden">
                        <div className="absolute inset-0 bg-red-600/10 group-active:bg-red-600/30 transition-colors" />
                        <span className="relative text-red-500 font-black text-[10px] tracking-widest uppercase">Emergency</span>
                        <span className="relative text-white font-black text-xl leading-none">KILL</span>
                    </div>
                    <p className="text-red-500/40 text-[8px] font-bold uppercase tracking-widest mt-2">Instant Disarm</p>
                </div>
            </div>

            {/* MAIN INTERFACE - Spread across width */}
            <main className="w-full flex flex-row items-end justify-between px-[4vw] pb-[4vh] gap-[2vw]">
                
                {/* Left Column: Movement */}
                <div className="flex flex-col items-center gap-2">
                    <p className="text-[9px] text-emerald-500/30 font-bold uppercase tracking-widest italic">Movement</p>
                    <Joystick leftSide={true} onMove={updateLeftJoystick} />
                </div>

                {/* Center Column: Telemetry & Arming */}
                <div className="flex-1 max-w-[400px] flex flex-row items-center justify-center gap-[3vw] mb-[2vh]">
                    <div className="flex flex-col gap-3 w-full">
                        <div className='bg-emerald-500/5 border border-emerald-500/20 p-3 rounded-xl min-h-[50px] flex items-center justify-center text-center backdrop-blur-sm'>
                            <p className="text-[min(2vw,12px)] leading-tight text-white font-mono">
                                {gotTheMessage ? (
                                    <><span className="text-emerald-400 font-bold">DRONE:</span> {JSON.stringify(gotTheMessage.theMessage)}</>
                                ) : ">> LINK_ESTABLISHED"}
                            </p>
                        </div>
                        <div className='bg-black/40 border border-emerald-500/10 p-2 rounded-xl grid grid-cols-3 gap-1 text-center text-emerald-400 font-mono text-[min(1.8vw,10px)]'>
                            <div className="border-r border-emerald-500/10"><p className="text-[8px] text-emerald-500/40">LAT</p>{gotTheTelMessage?.theTelMessage?.gps_raw?.lat?.toFixed(4) || "0.000"}</div>
                            <div className="border-r border-emerald-500/10"><p className="text-[8px] text-emerald-500/40">LON</p>{gotTheTelMessage?.theTelMessage?.gps_raw?.lon?.toFixed(4) || "0.000"}</div>
                            <div><p className="text-[8px] text-emerald-500/40">BATT</p>{gotTheTelMessage?.theTelMessage?.battery?.p || 0}%</div>
                        </div>
                    </div>

                    {/* Action Slider */}
                    <div
                        ref={sliderRef}
                        onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); setIsDraggingSlider(true); hasTriggeredAction.current = false; }}
                        onPointerMove={handleSliderMove}
                        onPointerUp={() => { setIsDraggingSlider(false); setYPos(0); }}
                        onPointerCancel={() => { setIsDraggingSlider(false); setYPos(0); }}
                        className="relative w-12 h-32 lg:w-16 lg:h-48 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center shrink-0"
                    >
                        <div className="absolute top-2 text-[7px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                        <div className="absolute bottom-2 text-[7px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
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

                {/* Right Column: Alt & Yaw */}
                <div className="flex flex-row items-end gap-[2vw]">
                    {/* Altitude Vertical Slider */}
                    <div className="flex flex-col items-center mb-2">
                        <span className="text-[10px] text-blue-400 font-black font-mono mb-1">{altitude}m</span>
                        <div className="relative w-8 h-50 max-h-[180px] bg-black/60 border border-blue-500/30 rounded-full p-1 flex flex-col-reverse overflow-hidden">
                            <input
                                type="range" min="0" max="50" step="1" value={altitude}
                                onChange={(e) => { const v = parseInt(e.target.value); setAltitude(v); altRef.current = v; }}
                                className="absolute inset-0 opacity-0 cursor-pointer h-full w-full appearance-none z-10"
                            />
                            <div className="w-full bg-gradient-to-t from-blue-700 to-blue-400 rounded-full transition-all duration-200" style={{ height: `${(altitude / 50) * 100}%` }} />
                        </div>
                        <p className="text-[8px] text-blue-500 uppercase font-black mt-1">Alt</p>
                    </div>

                    <div className="flex flex-col items-center gap-2">
                        <p className="text-[9px] text-emerald-500/30 font-bold uppercase tracking-widest italic">Rotation</p>
                        <Joystick leftSide={false} onMove={updateRightJoystick} />
                    </div>
                </div>
            </main>

            <style dangerouslySetInnerHTML={{ __html: `
                .green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); }
                * { 
                    touch-action: none !important; 
                    -webkit-user-select: none !important;
                    user-select: none !important; 
                    -webkit-tap-highlight-color: transparent !important;
                }
                input[type=range] { -webkit-appearance: slider-vertical; }
            ` }} />
        </div>
    );
};