import { useState } from 'react';
import { Toaster, toast } from "react-hot-toast";
import { Routes, Route, Navigate } from 'react-router-dom';
import { HomePage } from './Pages/HomePage';
import { LoginPage } from './Pages/LoginPage';
import { SignUpPage } from './Pages/SignUpPage';
import { useAuthState } from './Store/useAuthStore';
import { Eye, EyeOff, Loader2, Lock, Mail, MessageSquare, User } from "lucide-react";
import { useEffect } from 'react';
import { MarketplacePage } from './Pages/MarketPlacePage';
import { Features } from './Pages/FeaturesPage';
import { ProductPage } from './Pages/ProductPage';
import { CompanyPage } from './Pages/CompanyPage';
import { UpdateUninstallLifePage } from './Pages/UpdateUninstallLifePage';



function App() {

  const [count, setCount] = useState(0);

  const { authUser, isCheckingAuth, checkAuth } = useAuthState();

  useEffect(() => {
    checkAuth();
  }, [checkAuth])

  //console.log("Current Auth User:", authUser);

  if (isCheckingAuth && !authUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#050a05]">
        <Loader2 className='size-10 text-emerald-500 animate-spin' />
        <span className="ml-2 text-emerald-500 font-semibold">Verifying session...</span>
      </div>
    )
  }

  const handleHomePageWhileAuth = () => {
    if (authUser) {
      if (authUser.usertype == "Consumer") {
        return <Navigate to="/marketplace" />
      }
      else if (authUser.usertype == "Drone User") {
        return <Navigate to="/product" />
      }
      else {
        return <HomePage />
      }
    }
    else{
      return <HomePage />;
    }
    
  }

  const handleSignupPageWhileAuth = () => {
    if (authUser) {
      if (authUser.usertype == "Consumer") {
        return <Navigate to="/marketplace" />
      }
      else if (authUser.usertype == "Drone User") {
        return <Navigate to="/product" />
      }
      else {
        return <SignUpPage />;
      }
    }
    else{
      return <SignUpPage />;
    }
  }

    const handleLoginPageWhileAuth = () => {
    if (authUser) {
      if (authUser.usertype == "Consumer") {
        return <Navigate to="/marketplace" />
      }
      else if (authUser.usertype == "Drone User") {
        return <Navigate to="/product" />
      }
      else {
        return <LoginPage />;
      }
    }
    else{
      return <LoginPage />;
    }
  }

  return (
    <div>
      <Toaster
        toastOptions={{
          duration: 4000,
        }}
        position="top-center"
        reverseOrder={false}
      />
      <Routes>
        <Route path="/" element={handleHomePageWhileAuth()} />
        <Route path="/login" element={handleLoginPageWhileAuth()} />
        <Route path="/signup" element={handleSignupPageWhileAuth()} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/features" element={<Features />} />
        <Route path="/product" element={<ProductPage />} />
        <Route path="/company" element={<CompanyPage />} />
        <Route path="/updateuinstall" element={<UpdateUninstallLifePage />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </div>
  )
}


export default App;
