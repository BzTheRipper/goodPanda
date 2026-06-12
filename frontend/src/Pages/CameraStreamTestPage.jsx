import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export const CameraStreamTestPage = () => {
    // This is the URL from your Cloudflare Tunnel
    // MediaMTX automatically provides a web player at the root of the WebRTC port
    const streamUrl = "https://despite-payroll-lights-reg.trycloudflare.com/video_feed"; 

    return (
        <div className="h-screen w-full bg-black flex flex-col relative overflow-hidden">
            {/* Header */}
            <div className="absolute top-0 left-0 w-full z-10 p-4 bg-gradient-to-b from-black/80 to-transparent flex items-center gap-4">
                <Link to="/" className="p-2 bg-emerald-500/20 rounded-full text-emerald-400 hover:bg-emerald-500/40 transition-all">
                    <ArrowLeft size={24} />
                </Link>
                <h1 className="text-emerald-400 font-bold tracking-widest green-glow">CAMERA SYSTEM TEST</h1>
            </div>

            {/* Camera Feed */}
            <div className="flex-1 flex items-center justify-center">
                {/* MediaMTX WebRTC player works best inside an iframe */}
                <iframe
                    src={streamUrl}
                    className="w-full h-full border-none"
                    allow="autoplay; fullscreen"
                />
            </div>

            {/* HUD Overlay Info */}
            <div className="absolute bottom-6 right-6 p-4 bg-black/60 border border-emerald-500/20 rounded-xl backdrop-blur-md">
                <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[10px] text-gray-300 font-mono uppercase tracking-tighter">Live Feed: 720p 30fps</span>
                </div>
            </div>

            <style dangerouslySetInnerHTML={{ __html: `.green-glow { text-shadow: 0 0 10px rgba(16, 185, 129, 0.6); }` }} />
        </div>
    );
};