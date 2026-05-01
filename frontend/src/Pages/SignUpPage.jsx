import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User } from "lucide-react";
import { ArrowLeftIcon } from '@heroicons/react/24/outline'
import signupSideImage from '../ImageAndLogos/signup_side_image.png'
import { useAuthState } from '../Store/useAuthStore.js'
import toast from 'react-hot-toast'

export const SignUpPage = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState({
    fullname: "",
    email: "",
    password: "",
    usertype: "Consumer"
  })

  const { signup, isSigningUp } = useAuthState();

  const validateForm = () => {
    if (!formData.fullname || !formData.fullname.trim()) return toast.error("Full name is required");
    if (!formData.email.trim()) return toast.error("Email is required");
    if (!/\S+@\S+\.\S+/.test(formData.email)) return toast.error("Invalid email format");
    if (!formData.password) return toast.error("Password is required");
    if (formData.password.length < 6) return toast.error("Password must be at least 6 characters")
    return true
  }

  const handleSubmit = async (e) => {
    e.preventDefault();

    const form_validated = validateForm();

    if (form_validated) {
      const success = signup(formData)
    }
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
      <div className="absolute bottom-[-10%] left-[20%] w-[30%] h-[30%] rounded-full bg-mint-500/5 blur-[100px] pointer-events-none" />

      {/* LEFT SIDE: Form Content */}
      <div className="flex flex-col justify-center px-6 py-12 lg:flex-none lg:w-[40%] lg:px-20 xl:px-24 z-10">
        <div className="mx-auto w-full max-w-sm lg:w-96">
          <div>
            <span className="text-emerald-400 font-bold text-2xl tracking-widest green-glow">
              Good Panda
            </span>
            <h2 className="mt-8 text-3xl font-bold tracking-tight text-white">
              Sign up for an account
            </h2>
          </div>

          <div className="mt-10">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Full Name */}
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-emerald-400">
                  Full Name <span className='text-red-500 ml-1'>*</span>
                </label>
                <div className="mt-2">
                  <input
                    id="name"
                    name="name"
                    type="text"
                    value={formData.fullname}
                    onChange={(e) => setFormData({ ...formData, fullname: e.target.value })}
                    required
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-emerald-400">
                  Email address <span className='text-red-500 ml-1'>*</span>
                </label>
                <div className="mt-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    required
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-emerald-400">
                  Password <span className='text-red-500 ml-1'>*</span>
                </label>

                <div className="mt-2 relative">
                  <input
                    id="password"
                    name="password"
                    type={showPassword ? "text" : "password"}
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    required
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 pl-3 pr-10 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all" />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {
                      (showPassword) ?
                        <EyeOff className="size-5 text-base-content/40" />
                        :
                        <Eye className="size-5 text-base-content/40" />
                    }
                  </button>
                </div>
              </div>

              {/*User Type*/}
              <div>
                <label htmlFor="usertype" className="block text-sm font-medium text-emerald-400">
                  User Type <span className='text-emerald-400'>✔</span>
                </label>
                <div className="mt-2 relative">
                  <select
                    className="block w-full rounded-md border border-emerald-500/20 bg-emerald-950/20 px-3 py-2 text-white shadow-sm ring-1 ring-inset ring-emerald-500/10 focus:ring-2 focus:ring-emerald-400 focus:outline-none sm:text-sm transition-all appearance-none"
                    name="usertype"
                    id="usertype"
                    value={formData.usertype}
                    onChange={(e) => setFormData({ ...formData, usertype: e.target.value })}
                    required
                  >
                    <option value="Consumer" className="bg-[#050a05]">Consumer</option>
                    <option value="Drone User" className="bg-[#050a05]">Drone User / Business Owner</option>
                  </select>
                </div>
              </div>

              <div className='mt-5'>
                <button
                  type="submit"
                  className="flex w-full justify-center rounded-md bg-emerald-600 px-3 py-2 text-sm font-semibold text-white shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-500 hover:shadow-emerald-400/40 transition-all active:scale-[0.98]"
                  disabled={isSigningUp}
                >
                  {isSigningUp ? (
                    <>
                      <Loader2 className='size-5 animate-spin' />
                      Loading...
                    </>
                  ) : (
                    "Create Account"
                  )}
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
                    Already have an account?{' '}
                    <Link to="/login" className="ml-1 font-semibold text-emerald-400 hover:text-emerald-300">
                      Login
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
          src={signupSideImage}
          alt="Good Panda Delivery"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#050a05] via-emerald-900/10 to-transparent" />
      </div>
    </div>
  )
}