import React, { useState, useEffect } from 'react'
import { useAuthState } from '../Store/useAuthStore';

export const MessagetestPage = () => {
    const { socket } = useAuthState();
    const [gotTheMessage, setGotTheMessage] = useState("");

    // 1. Listen for incoming messages from Socket
    useEffect(() => {
        if (!socket) return;
        socket.on("message", (theMessage) => {
            setGotTheMessage(theMessage)
        })
        return () => socket.off("message");
    }, [socket]);

    // 2. Helper function to send the direction to the backend
    const sendDirection = (dir) => {
        if (!socket) return;
        console.log("Sending direction:", dir);
        socket.emit('user-message', dir);
    };

    // 3. Listen for Keyboard Keys (W, A, S, D)
    useEffect(() => {
        const handleKeyDown = (e) => {
            const key = e.key.toLowerCase();
            if (key === 'w') sendDirection("up");
            if (key === 's') sendDirection("down");
            if (key === 'a') sendDirection("left");
            if (key === 'd') sendDirection("right");
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [socket]); // Re-bind if socket changes

    return (
        <div className="min-h-screen bg-[#050a05] flex flex-col items-center justify-center gap-4">
            
            <h1 className="text-emerald-400 font-bold mb-4">Use Buttons or WASD Keys</h1>

            {/* UP BUTTON */}
            <button
                className="bg-[#2dd4bf] hover:bg-[#5eead4] text-black font-bold py-4 px-8 rounded-lg active:scale-95 transition-all"
                onClick={() => sendDirection("up")}
            >
                Up (W deploy)
            </button>

            <div className="flex gap-4">
                {/* LEFT BUTTON */}
                <button
                    className="bg-[#2dd4bf] hover:bg-[#5eead4] text-black font-bold py-4 px-8 rounded-lg active:scale-95 transition-all"
                    onClick={() => sendDirection("left")}
                >
                    Left (A)
                </button>

                {/* RIGHT BUTTON */}
                <button
                    className="bg-[#2dd4bf] hover:bg-[#5eead4] text-black font-bold py-4 px-8 rounded-lg active:scale-95 transition-all"
                    onClick={() => sendDirection("right")}
                >
                    Right (D)
                </button>
            </div>

            {/* DOWN BUTTON */}
            <button
                className="bg-[#2dd4bf] hover:bg-[#5eead4] text-black font-bold py-4 px-8 rounded-lg active:scale-95 transition-all"
                onClick={() => sendDirection("down")}
            >
                Down (S)
            </button>

            {/* MESSAGE DISPLAY */}
            <div className='mt-10 text-white border border-emerald-500/20 p-4 rounded-xl bg-emerald-500/5 min-w-[300px] text-center'>
                {gotTheMessage ? (
                    <p><span className="text-emerald-400 font-bold">{gotTheMessage.name}:</span> {gotTheMessage.theMessage}</p>
                ) : (
                    <p className="text-gray-500 italic text-sm">System Idle - Waiting for messages...</p>
                )}
            </div>

        </div>
    );
}