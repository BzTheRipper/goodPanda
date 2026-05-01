import React from 'react'
import { useAuthState } from '../Store/useAuthStore'
import { LogOut, ShoppingBag } from 'lucide-react'

export const MarketplacePage = () => {
  const { logout, authUser } = useAuthState();

  return (
    <div className="min-h-screen bg-[#050a05] text-white">
      {/* NAVBAR AREA */}
      <header className="flex justify-between items-center p-6 border-b border-emerald-500/10">
        <div className="flex items-center gap-2">
          <ShoppingBag className="text-emerald-500 size-6" />
          <span className="text-xl font-bold tracking-widest green-glow">MARKETPLACE</span>
        </div>

        <div className="flex items-center gap-6">
          {/* Welcome User text */}
          <span className="hidden sm:block text-sm text-gray-400">
            Welcome back, <span className="text-emerald-400 font-medium">{authUser?.fullname}</span>
          </span>

          {/* LOGOUT BUTTON */}
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
      <main className="p-8 flex flex-col items-center justify-center mt-20">
        <h1 className="text-4xl font-bold mb-4 green-glow">Welcome to the Marketplace</h1>
        <p className="text-gray-400 text-center max-w-md">
          This is where you can browse and manage your orders. 
          Your current user type is: <span className="text-emerald-400 font-bold uppercase">{authUser?.usertype}</span>
        </p>
      </main>
    </div>
  )
}