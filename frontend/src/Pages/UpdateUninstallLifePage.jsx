import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from '@heroicons/react/24/outline';

export const UpdateUninstallLifePage = () => {
  return (
    <div className="min-h-screen bg-[#050a05] flex flex-col items-center justify-center relative overflow-hidden">
      
      {/* Home Button */}
      <Link 
        to="/" 
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-all group"
      >
        <ArrowLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
        <span>Home</span>
      </Link>


      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-red-500/5 blur-[120px] pointer-events-none" />

      <h1 className="text-blue-400 text-4xl font-black mb-16 blue-glow tracking-[0.2em] uppercase">
        Depressed??
      </h1>

      <div className="flex flex-col md:flex-row items-center justify-center gap-16">
        

        <button className="group flex items-center hover:scale-105 transition-transform duration-500 outline-none">
          <div className="relative w-64 h-28 border-[3px] border-emerald-500 rounded-2xl overflow-hidden flex items-center justify-center bg-[#050a05] shadow-[0_0_20px_rgba(16,185,129,0.3)] group-hover:shadow-[0_0_35px_rgba(16,185,129,0.6)] transition-shadow">
            <div className="absolute bottom-0 left-0 w-full h-[75%] bg-emerald-500/90 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <div className="wave-mask wave-1 bg-[#050a05]"></div>
              <div className="wave-mask wave-2 bg-[#050a05]/60"></div>
            </div>
            <span className="relative z-10 text-white font-black text-xl tracking-widest drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)] text-center px-4">
              Update The Fokin Loife
            </span>
          </div>
          <div className="w-4 h-12 border-y-[3px] border-r-[3px] border-emerald-500 rounded-r-md bg-emerald-500 shadow-[5px_0_15px_rgba(16,185,129,0.4)]"></div>
        </button>

        <button className="group flex items-center hover:scale-105 transition-transform duration-500 outline-none">
          <div className="relative w-64 h-28 border-[3px] border-red-500 rounded-2xl overflow-hidden flex items-center justify-center bg-[#050a05] shadow-[0_0_20px_rgba(239,68,68,0.3)] group-hover:shadow-[0_0_35px_rgba(239,68,68,0.6)] transition-shadow">
            <div className="absolute bottom-0 left-0 w-full h-[35%] bg-red-500/90 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]">
              <div className="wave-mask wave-3 bg-[#050a05]"></div>
              <div className="wave-mask wave-4 bg-[#050a05]/60"></div>
            </div>
            <span className="relative z-10 text-white font-black text-xl tracking-widest drop-shadow-[0_3px_3px_rgba(0,0,0,0.8)]">
              UNINSTALL
            </span>
          </div>
          <div className="w-4 h-12 border-y-[3px] border-r-[3px] border-red-500 rounded-r-md bg-red-500 shadow-[5px_0_15px_rgba(239,68,68,0.4)]"></div>
        </button>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        /* The Blue Glow Effect */
        .blue-glow {
          text-shadow: 
            0 0 10px rgba(96, 165, 250, 0.8),
            0 0 20px rgba(96, 165, 250, 0.5),
            0 0 40px rgba(37, 99, 235, 0.3);
        }

        .wave-mask {
          position: absolute;
          width: 500px;
          height: 500px;
          left: 50%;
          bottom: 100%;
        }

        .wave-1 {
          border-radius: 40%;
          margin-left: -250px;
          margin-bottom: -20px;
          animation: spin-normal 6s linear infinite;
        }

        .wave-2 {
          border-radius: 45%;
          margin-left: -250px;
          margin-bottom: -30px;
          animation: spin-reverse 4s linear infinite;
        }

        .wave-3 {
          border-radius: 40%;
          margin-left: -250px;
          margin-bottom: -15px;
          animation: spin-normal 5s linear infinite;
        }

        .wave-4 {
          border-radius: 43%;
          margin-left: -250px;
          margin-bottom: -25px;
          animation: spin-reverse 3.5s linear infinite;
        }

        @keyframes spin-normal {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes spin-reverse {
          0% { transform: rotate(360deg); }
          100% { transform: rotate(0deg); }
        }
      `}} />
    </div>
  );
};