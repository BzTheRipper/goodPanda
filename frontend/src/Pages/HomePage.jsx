import { useState } from 'react'
import { Dialog, DialogPanel } from '@headlessui/react'
import { Bars3Icon, XMarkIcon } from '@heroicons/react/24/outline'
import { Link } from 'react-router-dom'
import {useAuthState} from '../Store/useAuthStore.js'

const navigation = [
  { name: 'Product', href: '/product' },
  { name: 'Features', href: '/features' },
  { name: 'Marketplace', href: '/marketplace' },
  { name: 'Company', href: '/company' },
]

export const HomePage = () => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const {authUser, checkAuth, isCheckingAuth} = useAuthState();
  
  const handleCheckAuthTestButton = (e) => {
    e.preventDefault();
    
    const success = checkAuth();

  }

  return (
    <div className="bg-[#050a05] min-h-screen">
      <header className="absolute inset-x-0 top-0 z-50">
        <nav className="flex items-center justify-between p-6 lg:px-8">
          <div className="flex lg:flex-1">
            <span className="text-emerald-500 font-bold text-xl tracking-widest green-glow">Good Panda</span>
          </div>

          <div className="flex lg:hidden">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="-m-2.5 inline-flex items-center justify-center rounded-md p-2.5 text-emerald-400"
            >
              <Bars3Icon aria-hidden="true" className="size-6" />
            </button>
          </div>

          <div className="hidden lg:flex lg:gap-x-12">
            {navigation.map((item) => (
              <a key={item.name} href={item.href} className="text-sm/6 font-semibold text-gray-300 hover:text-emerald-400 transition-colors">
                {item.name}
              </a>
            ))}
          </div>

          {/* DESKTOP: LOGIN & SIGN UP BUTTONS */}
          <div className="hidden lg:flex lg:flex-1 lg:justify-end lg:items-center lg:gap-x-6">
            <Link to="/login" className="text-sm font-semibold text-white hover:text-emerald-400 transition-colors">
              Log in
            </Link>
            <Link
              to="/signup"
              className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-500 hover:shadow-emerald-500/40 transition-all"
            >
              Sign up
            </Link>
          </div>
        </nav>

        <Dialog open={mobileMenuOpen} onClose={setMobileMenuOpen} className="lg:hidden">
          <div className="fixed inset-0 z-50" />
          <DialogPanel className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto bg-[#050a05] p-6 sm:max-w-sm border-l border-emerald-500/20">
            <div className="flex items-center justify-between">
              <span className="text-emerald-500 font-bold">Good Panda</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="-m-2.5 rounded-md p-2.5 text-emerald-400"
              >
                <XMarkIcon aria-hidden="true" className="size-6" />
              </button>
            </div>
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-emerald-500/10">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => (
                    <a
                      key={item.name}
                      href={item.href}
                      className="-mx-3 block rounded-lg px-3 py-2 text-base font-semibold text-gray-300 hover:text-emerald-400"
                    >
                      {item.name}
                    </a>
                  ))}
                </div>
                {/* MOBILE: LOGIN & SIGN UP BUTTONS */}
                <div className="py-6 space-y-4">
                  <Link
                    to="/login"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 block rounded-lg px-3 py-2.5 text-base font-semibold text-white hover:bg-emerald-500/10"
                  >
                    Log in
                  </Link>
                  <Link
                    to="/signup"
                    onClick={() => setMobileMenuOpen(false)}
                    className="block rounded-lg bg-emerald-600 px-3 py-2.5 text-center text-base font-semibold text-white shadow-lg"
                  >
                    Sign up
                  </Link>
                </div>
              </div>
            </div>
          </DialogPanel>
        </Dialog>
      </header>

      <div className="relative isolate px-6 pt-14 lg:px-8">
        <div className="absolute inset-x-0 -top-40 -z-10 transform-gpu overflow-hidden blur-3xl sm:-top-80">
          <div
            style={{
              clipPath: 'polygon(74.1% 44.1%, 100% 61.6%, 97.5% 26.9%, 85.5% 0.1%, 80.7% 2%, 72.5% 32.5%, 60.2% 62.4%, 52.4% 68.1%, 47.5% 58.3%, 45.2% 34.5%, 27.5% 76.7%, 0.1% 64.9%, 17.9% 100%, 27.6% 76.8%, 76.1% 97.7%, 74.1% 44.1%)'
            }}
            className="relative left-[calc(50%-11rem)] aspect-1155/678 w-[72.1875rem] -translate-x-1/2 rotate-[30deg] bg-gradient-to-tr from-[#10b981] to-[#064e3b] opacity-30 sm:left-[calc(50%-30rem)]"
          />
        </div>

        <div className="mx-auto max-w-2xl py-32 sm:py-48 lg:py-56">
          <div className="text-center">
            <h1 className="text-5xl font-semibold tracking-tight text-white sm:text-6xl green-glow">
              Connecting The Nation
            </h1>
            <div className='mt-3'>
              <h1 className="text-5xl font-semibold tracking-tight text-emerald-400 sm:text-5xl green-glow">
                Beyond The Sky
              </h1>
            </div>
            <p className="mt-8 text-lg font-medium text-gray-400 sm:text-xl/8">
              Where empty and infinity both exists parallelly
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link
                to="/signup"
                className="rounded-md bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 hover:shadow-emerald-500/40 transition-all"
              >
                Get started
              </Link>
              <a href="#" className="text-sm/6 font-semibold text-emerald-400 hover:text-emerald-300 transition-colors">
                Learn more <span aria-hidden="true">→</span>
              </a>
              <button
                to="/signup"
                className="rounded-md bg-emerald-600 px-3.5 py-2.5 text-sm font-semibold text-white shadow-lg hover:bg-emerald-500 hover:shadow-emerald-500/40 transition-all"
                onClick={handleCheckAuthTestButton}
              >
                Check Auth Test
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}