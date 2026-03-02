import React from 'react'
import { useAuthState } from '../Store/useAuthStore'
import { LogOut, Package, ArrowLeft } from 'lucide-react'
import { Link } from 'react-router-dom'

export const ProductPage = () => {
  const { logout, authUser } = useAuthState();

  return (
    <div className="min-h-screen bg-[#050a05] text-white selection:bg-emerald-500/30">
      
      {/* NAVBAR AREA (Consistent with Marketplace) */}
      <header className="flex justify-between items-center p-6 border-b border-emerald-500/10 bg-[#050a05]/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-4">
          {/* Back to Home/Marketplace link */}
          <Link to="/" className="p-2 hover:bg-emerald-500/10 rounded-full transition-colors text-emerald-500">
            <ArrowLeft className="size-5" />
          </Link>
          <div className="flex items-center gap-2">
            <Package className="text-emerald-500 size-6" />
            <span className="text-xl font-bold tracking-widest green-glow">PRODUCT CATALOG</span>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className="hidden sm:block text-sm text-gray-400">
            Signed in as: <span className="text-emerald-400 font-medium">{authUser?.fullname}</span>
          </span>

          <button
            onClick={logout}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-600 hover:text-white transition-all duration-300 shadow-lg shadow-red-900/20"
          >
            <LogOut className="size-4" />
            <span className="text-sm font-semibold">Logout</span>
          </button>
        </div>
      </header>

      {/* CONTENT AREA */}
      <main className="max-w-7xl mx-auto p-8">
        <div className="flex flex-col items-center justify-center mt-12 mb-16 text-center">
          <h1 className="text-4xl font-bold mb-4 green-glow">Our Products</h1>
          <p className="text-gray-400 max-w-2xl">
            Explore the latest drone technology and inventory. 
            All items are verified for <span className="text-emerald-500">Good Panda</span> high-speed delivery.
          </p>
        </div>

        {/* PRODUCT GRID PLACEHOLDER */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {[1, 2, 3].map((item) => (
            <div key={item} className="bg-emerald-950/10 border border-emerald-500/10 rounded-2xl p-6 hover:border-emerald-500/40 transition-all group">
              <div className="aspect-square bg-[#0a0f0a] rounded-xl mb-4 overflow-hidden relative">
                 <div className="absolute inset-0 flex items-center justify-center text-emerald-900 font-bold text-6xl">
                    <Package className="size-20 opacity-20" />
                 </div>
              </div>
              <h3 className="text-xl font-bold text-emerald-400 mb-2">Item Name {item}</h3>
              <p className="text-gray-500 text-sm mb-4">High performance components with green mist certification.</p>
              <div className="flex justify-between items-center">
                <span className="text-white font-bold text-lg">$299.00</span>
                <button className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-lg shadow-emerald-900/40">
                  View Details
                </button>
              </div>
            </div>
          ))}
        </div>
      </main>

      <style dangerouslySetInnerHTML={{ __html: `
        .green-glow {
          text-shadow: 0 0 15px rgba(16, 185, 129, 0.6);
        }
      `}} />
    </div>
  )
}