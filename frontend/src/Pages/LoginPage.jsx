import { useState } from 'react'
import { useAuthState } from '../Store/useAuthStore.js'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User } from "lucide-react";
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import loginSideImage from '../ImageAndLogos/goodPandaGreenLogo.png'
import toast from 'react-hot-toast'

export const LoginPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const { login, isLoggingIn } = useAuthState();

  const handleSubmit = (e) => {
    e.preventDefault();

    const success = login(formData);
  }

  return (
    // Main Container
    <div className="flex min-h-screen bg-[#050a05] relative overflow-hidden">

      {/* HOME BUTTON: Top Left Corner */}
      <Link
        to="/"
        className="absolute top-6 left-6 z-20 flex items-center gap-2 text-sm font-semibold text-emerald-400 hover:text-emerald-300 transition-all group"
      >
        <ArrowLeftIcon className="h-5 w-5 transition-transform group-hover:-translate-x-1" />
        <span>Home</span>
      </Link>

      {/* MINT GREEN VIBE: Background Glows */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-emerald-500/10 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-emerald-400/5 blur-[100px] pointer-events-none" />

      {/* LEFT SIDE: Form Content */}
      <div className="flex flex-col justify-center px-6 py-12 lg:flex-none lg:w-[40%] lg:px-20 xl:px-24 z-10">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <span className="text-emerald-400 font-bold text-2xl tracking-widest green-glow">
              Good Panda
            </span>
            <h2 className="mt-8 text-3xl font-bold tracking-tight text-white">
              Sign in to your account
            </h2>
          </div>

          <div className="mt-10">
            <form onSubmit={handleSubmit} method="POST" className="space-y-6">
              {/* Email Field */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-emerald-400">
                  Email address
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    autoComplete="email"
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all"
                  />
                </div>
              </div>

              {/* Password Field */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-emerald-400">
                  Password
                </label>
                <div className="mt-2 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    autoComplete="current-password"
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 pl-3 pr-10 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {
                      showPassword ?
                        <EyeOff className="size-5 text-base-content/40" />
                        :
                        <Eye className="size-5 text-base-content/40" />
                    }
                  </button>
                </div>
                <div className="mt-2 flex justify-end">
                  <Link to="/forgot-password" className="text-xs font-semibold text-emerald-500 hover:text-emerald-400 transition-colors">
                    Forgot password?
                  </Link>
                </div>
              </div>

              <div>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-emerald-400/40 transition-all active:scale-[0.98]"
                  disabled={isLoggingIn}
                >
                  {
                    isLoggingIn ?
                      (
                        <>
                          <Loader2 className='size-5 animate-spin' />
                          Loading...
                        </>
                      )
                    :
                      (
                        "Log in"
                      )
                  }
                </button>
              </div>
            </form>

            <div className="mt-10">
              <div className="relative">
                <div className="absolute inset-0 flex items-center" aria-hidden="true">
                  <div className="w-full border-t border-emerald-500/20" />
                </div>
                <div className="relative flex justify-center text-sm font-medium">
                  <span className="bg-[#050a05] px-4 text-gray-400">
                    Don't have an account?{' '}
                    <Link to="/signup" className="ml-1 font-semibold text-emerald-400 hover:text-emerald-300">
                      Sign Up
                    </Link>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: Image */}
      <div className="relative hidden flex-1 lg:block lg:w-[60%]">
        <img
          className="absolute inset-0 h-full w-full object-cover"
          src={loginSideImage}
          alt="Good Panda Delivery"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050a05] via-emerald-900/10 to-transparent" />
      </div>
    </div>
  )
}