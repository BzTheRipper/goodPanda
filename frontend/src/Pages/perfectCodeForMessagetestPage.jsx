
import React, { useState, useEffect, useRef } from 'react'
import { useAuthState } from '../Store/useAuthStore';
import {
    ChevronUp, ChevronDown, ChevronLeft, ChevronRight,
    RotateCcw, RotateCw, ArrowUp, ArrowDown, Power, ArrowDownToLine, Circle
} from "lucide-react";


export const MessagetestPage = () => {
    // Basic state to keep the UI from crashing
    const { socket } = useAuthState();
    const [gotTheMessage, setGotTheMessage] = useState(null);
    const [gotTheTelMessage, setGotTheTelMessage] = useState(null);
    const [isLandscape, setIsLandscape] = useState(window.innerWidth > window.innerHeight);
    const [isFullScreen, setIsFullScreen] = useState(false);
    const [isMobile, setIsMobile] = useState(/Mobi|Android|iPhone/i.test(navigator.userAgent));
    // Use a Set to store all currently pressed keys
    const activeKeys = useRef(new Set());

    const leftJoyDirs = useRef(new Set());
    const rightJoyDirs = useRef(new Set());



    const [directionCommand, setDirectionCommand] = useState([]);


    // --- SLIDER LOGIC STATE ---
    const [yPos, setYPos] = useState(0);
    const [isDraggingSlider, setIsDraggingSlider] = useState(false);
    const sliderRef = useRef(null);
    const hasTriggeredAction = useRef(false);

    // Status from Python Telemetry (Ensure your python emits "is_armed": True/False)
    const isArmedFromTel = gotTheTelMessage?.theTelMessage?.is_armed || false;

    useEffect(() => {
        if (!socket) return;

        const handleMessage = (msg) => {
            setGotTheMessage(msg);
        };

        const handleTelemetry = (tel) => {
            setGotTheTelMessage(tel);
        };

        socket.on("message", handleMessage);
        socket.on("telemetryMessage", handleTelemetry);

        return () => {
            socket.off("message", handleMessage);
            socket.off("telemetryMessage", handleTelemetry);
        };
    }, []);

    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (["arrowup", "arrowdown", "arrowleft", "arrowright", " "].includes(key)) e.preventDefault();
            activeKeys.current.add(key);

            // Keyboard shortcuts for Arm/Land
            if (key === 'k') if (socket) socket.emit('user-message', { commands: ["arm"] });
            if (key === 'l') if (socket) socket.emit('user-message', { commands: ["land"] });
        };
        const handleKeyUp = (e) => {
            activeKeys.current.delete(e.key.toLowerCase());
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);
        return () => {
            window.removeEventListener("keydown", handleKeyDown);
            window.removeEventListener("keyup", handleKeyUp);
        };
    }, []);

    // 2. THE GAME LOOP (Replaces setInterval)
    // This runs 60 times per second and merges Keyboard + Joysticks
    useEffect(() => {
        if (!socket) return;

        let animationId;
        let lastTime = 0;
        let lastSent = ""; // prevent duplicate sends

        const loop = (time) => {
            if (time - lastTime > 100) { // ~20 FPS
                lastTime = time;

                const finalCommands = new Set();
                const keys = activeKeys.current;

                // Keyboard
                if (keys.has("w")) finalCommands.add("forward");
                if (keys.has("s")) finalCommands.add("backward");
                if (keys.has("a")) finalCommands.add("left");
                if (keys.has("d")) finalCommands.add("right");
                if (keys.has("arrowup") || keys.has("8")) finalCommands.add("up");
                if (keys.has("arrowdown") || keys.has("2")) finalCommands.add("down");
                if (keys.has("arrowleft") || keys.has("4")) finalCommands.add("rotate_left");
                if (keys.has("arrowright") || keys.has("6")) finalCommands.add("rotate_right");

                // Joystick
                leftJoyDirs.current.forEach(cmd => finalCommands.add(cmd));
                rightJoyDirs.current.forEach(cmd => finalCommands.add(cmd));

                const cmdArray = Array.from(finalCommands);

                socket.emit("user-message", { commands: cmdArray });

            }

            animationId = requestAnimationFrame(loop);
        };

        animationId = requestAnimationFrame(loop);

        return () => cancelAnimationFrame(animationId);
    }, []);

    // --- SLIDER INTERACTION HANDLER ---
    const handleSliderMove = (e) => {
        if (!isDraggingSlider || !sliderRef.current) return;

        const rect = sliderRef.current.getBoundingClientRect();
        const centerY = rect.top + rect.height / 2;

        // Use clientY directly (PointerEvents work for both mouse and touch)
        let dy = e.clientY - centerY;

        // FIX 1: Set maxRange dynamically based on the actual element height
        // This ensures the knob can always reach the top/bottom edges
        const maxRange = rect.height / 2 - 10;

        // Constraint: Keep knob at the edge
        if (dy < -maxRange) dy = -maxRange;
        if (dy > maxRange) dy = maxRange;

        setYPos(dy);

        // FIX 2: Set threshold based on the actual range of the slider
        const threshold = maxRange * 0.80; // Trigger at 80% of the way to the edge

        if (!hasTriggeredAction.current) {
            if (dy < -threshold) { // Swipe UP
                if (socket) socket.emit('user-message', { commands: ["arm"] });
                if (navigator.vibrate) navigator.vibrate(50);
                hasTriggeredAction.current = true;
                console.log("🚀 ARMING TRIGGERED");
            } else if (dy > threshold) { // Swipe DOWN
                if (socket) socket.emit('user-message', { commands: ["land"] });
                if (navigator.vibrate) navigator.vibrate(50);
                hasTriggeredAction.current = true;
                console.log("🚀 LANDING TRIGGERED");
            }
        }
    };

    useEffect(() => { if (!isDraggingSlider) setYPos(0); }, [isDraggingSlider]);


    useEffect(() => {
        const handleFullscreenChange = () => {
            setIsFullScreen(!!document.fullscreenElement || !!document.webkitFullscreenElement);
        };

        document.addEventListener('fullscreenchange', handleFullscreenChange);
        document.addEventListener('webkitfullscreenchange', handleFullscreenChange);

        handleFullscreenChange();

        return () => {
            document.removeEventListener('fullscreenchange', handleFullscreenChange);
            document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
        };
    }, []);

    const enterLandscapeConsole = async () => {
        try {
            const element = document.documentElement;

            // 1. Enter Fullscreen
            if (element.requestFullscreen) {
                await element.requestFullscreen();
                setIsFullScreen(true);
            } else if (element.webkitRequestFullscreen) {
                await element.webkitRequestFullscreen();
                setIsFullScreen(true);
            }

            // 2. Lock Orientation (Only works after entering Fullscreen)
            if (screen.orientation && screen.orientation.lock) {
                await screen.orientation.lock('landscape').catch(e => {
                    console.log("Orientation lock not supported on this device/browser.");
                });
            }

        } catch (err) {
            console.error("Critical UI error:", err);
        }
    };

    useEffect(() => {
        const checkOrientation = () => {
            setIsLandscape(window.innerWidth > window.innerHeight);
        };

        window.addEventListener('resize', checkOrientation);
        return () => window.removeEventListener('resize', checkOrientation);
    }, []);

    // 1. JOYSTICK COMPONENT (Design only)
    const Joystick = ({ leftSide = true }) => {
        const baseRef = useRef(null);
        const [stickPos, setStickPos] = useState({ x: 0, y: 0 });
        const [isInteracting, setIsInteracting] = useState(false);

        const handlePointerMove = (e) => {
            if (!isInteracting || !baseRef.current) return

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

            // Update visuals
            setStickPos({ x: dx, y: dy });

            // Update logic ref for the Game Loop
            const threshold = maxRadius * 0.3;
            const newDirs = new Set();
            if (leftSide) {
                if (dy < -threshold) {

                    newDirs.add("forward");
                }
                if (dy > threshold) {

                    newDirs.add("backward");
                }
                if (dx < -threshold) {

                    newDirs.add("left");
                }
                if (dx > threshold) {

                    newDirs.add("right");
                }
                leftJoyDirs.current = newDirs;
            } else {
                if (dy < -threshold) {

                    newDirs.add("up");
                }
                if (dy > threshold) {

                    newDirs.add("down");
                }
                if (dx < -threshold) {

                    newDirs.add("rotate_left");
                }
                if (dx > threshold) {

                    newDirs.add("rotate_right");
                }
                rightJoyDirs.current = newDirs;
            }

        };

        return (
            <div className="relative flex flex-col items-center">
                <div
                    ref={baseRef}
                    className="w-28 h-28 lg:w-40 lg:h-40 rounded-full bg-emerald-500/5 border-2 border-emerald-500/10 relative flex items-center justify-center shadow-inner"
                    onPointerDown={(e) => { e.target.setPointerCapture(e.pointerId); setIsInteracting(true); }}
                    onPointerMove={handlePointerMove}
                    onPointerUp={() => {
                        setIsInteracting(false);
                        setStickPos({ x: 0, y: 0 });
                        if (leftSide) leftJoyDirs.current.clear(); else rightJoyDirs.current.clear();
                    }}
                    onPointerCancel={() => {
                        setIsInteracting(false);
                        setStickPos({ x: 0, y: 0 });

                        if (leftSide) leftJoyDirs.current.clear();
                        else rightJoyDirs.current.clear();
                    }}
                >
                    {/* Visual Axis lines */}
                    <div className="absolute inset-0 pointer-events-none opacity-10 flex items-center justify-center">
                        <div className="w-full h-0.5 bg-emerald-500" />
                        <div className="h-full w-0.5 bg-emerald-500 absolute" />
                    </div>
                    {/* The Knob (Now with dynamic movement) */}
                    <div
                        className="w-10 h-10 lg:w-14 lg:h-14 rounded-full shadow-2xl flex items-center justify-center bg-[#2dd4bf] pointer-events-none transition-transform duration-75 ease-out"
                        style={{
                            transform: `translate(${stickPos.x}px, ${stickPos.y}px)`
                        }}
                    >
                        <div className="w-3 h-3 rounded-full border border-black/10" />
                    </div>
                </div>
            </div>
        );
    };

    // ACTION SLIDER COMPONENT
    const ActionSlider = () => {
        return (
            <div className="flex flex-col items-center gap-1">
                <div
                    ref={sliderRef}
                    onPointerDown={(e) => {
                        e.target.setPointerCapture(e.pointerId);
                        setIsDraggingSlider(true);
                        hasTriggeredAction.current = false; // Reset for new swipe
                    }}
                    onPointerMove={handleSliderMove}
                    onPointerUp={() => {
                        setIsDraggingSlider(false);
                        setYPos(0); // Snap back ONLY on release
                    }}
                    onPointerCancel={() => {
                        setIsDraggingSlider(false);
                        setYPos(0);
                    }}
                    className="relative w-12 h-36 lg:w-16 lg:h-56 bg-white/5 rounded-3xl border border-white/10 flex items-center justify-center touch-none"
                >
                    <div className="absolute top-2 text-[6px] font-bold text-emerald-500 opacity-40 uppercase">Arm</div>
                    <div className="absolute bottom-2 text-[6px] font-bold text-orange-500 opacity-40 uppercase">Land</div>
                    <div className="w-full h-0.5 bg-white/10 absolute" />

                    <div
                        className="absolute w-10 h-10 lg:w-14 lg:h-14 flex items-center justify-center shadow-2xl transition-all duration-150"
                        style={{
                            transform: `translateY(${yPos}px)`,
                            // SHAPE MORPHING LOGIC
                            clipPath: !isArmedFromTel && Math.abs(yPos) < 15
                                ? "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" // Diamond (Neutral)
                                : isArmedFromTel || yPos < -15
                                    ? "polygon(20% 0%, 80% 0%, 100% 50%, 80% 100%, 20% 100%, 0% 50%)" // Hexagon (Arm)
                                    : "none", // Circle (Land)
                            borderRadius: (isArmedFromTel || yPos < -15 || Math.abs(yPos) < 15) ? "0" : "50%",
                            background: Math.abs(yPos) < 15 && !isArmedFromTel
                                ? "linear-gradient(180deg, #06b6d4 0%, #000 100%)" // Cyan Blue (Neutral)
                                : (isArmedFromTel || yPos < -15)
                                    ? "linear-gradient(180deg, #10b981 0%, #000 100%)" // Green (Arm)
                                    : "linear-gradient(180deg, #f97316 0%, #000 100%)", // Orange (Land)
                            border: "1px solid rgba(255,255,255,0.4)",
                            boxShadow: yPos < -20 ? "0 0 20px #10b981" : yPos > 20 ? "0 0 20px #f97316" : "none"
                        }}
                    >
                        {/* DYNAMIC TEXT / ICON */}
                        {yPos < -20 ? (
                            <span className="text-[6px] lg:text-[8px] font-black text-white animate-pulse">ARMING</span>
                        ) : yPos > 20 ? (
                            <span className="text-[6px] lg:text-[8px] font-black text-white animate-pulse">LANDING</span>
                        ) : Math.abs(yPos) < 15 && !isArmedFromTel ? (
                            <span className="text-[7px] font-black text-white italic">NTRL</span>
                        ) : isArmedFromTel ? (
                            <Power size={18} className="text-white" />
                        ) : (
                            <ArrowDownToLine size={18} className="text-white" />
                        )}
                    </div>
                </div>
                <span className="text-[7px] font-bold text-gray-600 uppercase tracking-tighter">System</span>
            </div>
        );
    };


    return (
        <div className="h-[100dvh] w-full bg-[#050a05] flex flex-col items-center touch-none overflow-hidden select-none">

            {isMobile && !isLandscape && (
                <div className="fixed inset-0 z-[100] bg-[#050a05] flex flex-col items-center justify-center text-center p-6 text-white font-bold">
                    <div className="w-16 h-16 border-4 border-emerald-500 rounded-xl animate-bounce flex items-center justify-center mb-4 text-emerald-500 text-3xl">🔄</div>
                    <p className="mb-4 uppercase tracking-widest">Rotate Device to Fly</p>
                    <button
                        onClick={enterLandscapeConsole}
                        className="bg-[#2dd4bf] text-black font-bold py-2 px-6 rounded-full text-sm shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                    >
                        TAP TO ROTATE
                    </button>
                </div>
            )}

            <header className="w-full py-2 flex justify-center items-center bg-[#2dd4bf]/5 border-b border-emerald-500/10">
                <h1 className="text-emerald-400 font-black tracking-[0.4em] uppercase text-[10px] lg:text-sm green-glow">
                    Panda Console
                </h1>
            </header>
            {isMobile && !isFullScreen && isLandscape && (
                <div className="fixed inset-0 z-[100] bg-[#050a05] flex flex-col items-center justify-center text-center p-6 text-white font-bold">
                    <div className="w-16 h-16 border-4 border-emerald-500 rounded-xl animate-bounce flex items-center justify-center mb-4 text-emerald-500 text-3xl">🔄</div>
                    <p className="mb-4 uppercase tracking-widest">Go to full screen to fly</p>
                    <button
                        onClick={enterLandscapeConsole}
                        className="bg-[#2dd4bf] text-black font-bold py-2 px-6 rounded-full text-sm shadow-[0_0_15px_rgba(45,212,191,0.5)]"
                    >
                        TAP TO GO FULL SCREEN
                    </button>
                </div>
            )}

            <main className="flex-1 w-full flex flex-row items-end justify-between px-4 pb-4 lg:px-12 lg:pb-12">

                {/* LEFT: MOVEMENT AREA */}
                <div className="flex-1 flex justify-start">
                    {isMobile && (
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] lg:text-[10px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic text-center">Movement</p>
                            <Joystick leftSide={true} />
                        </div>
                    )}
                </div>

                {/* CENTER AREA: HUD + SLIDER */}
                <div className="flex flex-row items-center gap-4 lg:gap-10 mb-4 shrink-0 z-10 w-fit">

                    {/* HUD BLOCK */}
                    <div className="flex flex-col gap-3 w-32 lg:w-80">
                        <div className='bg-emerald-500/5 border border-emerald-500/20 p-2 rounded-xl min-h-[45px] lg:min-h-[60px] flex items-center justify-center text-center overflow-hidden'>
                            {
                                !gotTheMessage ? (
                                    <p className="text-[9px] lg:text-[14px] leading-tight text-white font-mono tracking-tighter">&gt;&gt; LOGIC_CLEARED</p>)

                                    : (
                                        <p className="text-[9px] lg:text-[14px] leading-tight text-white font-mono tracking-tighter">
                                            <span className="text-[#2dd4bf] font-bold">{gotTheMessage.name}</span>:{" "}
                                            {Array.isArray(gotTheMessage?.theMessage?.commands)
                                                ? gotTheMessage.theMessage.commands.join(", ")
                                                : typeof gotTheMessage?.theMessage === "string"
                                                    ? gotTheMessage.theMessage
                                                    : JSON.stringify(gotTheMessage?.theMessage ?? "")
                                            }
                                        </p>
                                    )

                            }

                        </div>
                        <div className='bg-black/60 border border-emerald-500/10 p-2 rounded-xl shadow-lg grid grid-cols-3 text-center text-emerald-400 font-mono text-[8px] lg:text-[12px]'>
                            <div><p className="text-gray-600 text-[6px]">X</p>0.00</div>
                            <div><p className="text-gray-600 text-[7px]">Y</p>0.00</div>
                            <div><p className="text-gray-600 text-[6px]">θ</p>0.00</div>
                        </div>
                    </div>

                    <ActionSlider />
                </div>

                {/* RIGHT: ALT & YAW AREA */}
                <div className="flex-1 flex justify-end">
                    {isMobile && (
                        <div className="flex flex-col items-center mb-2 lg:mb-10 w-fit">
                            <p className="text-[8px] lg:text-[10px] text-emerald-500/40 font-bold mb-4 uppercase tracking-widest italic text-center">Alt & Yaw</p>
                            <Joystick leftSide={false} />
                        </div>
                    )}
                </div>

            </main>

            <style dangerouslySetInnerHTML={{ __html: `.green-glow { text-shadow: 0 0 10px rgba(45, 212, 191, 0.6); } * { -webkit-tap-highlight-color: transparent !important; touch-action: none !important; outline: none !important; }` }} />
        </div>
    );
}