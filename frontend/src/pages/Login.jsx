import { useState } from "react";
import { useNavigate, Navigate } from "react-router-dom";
import { FaUser, FaLock, FaEye, FaEyeSlash } from "react-icons/fa";
import { useAuth } from "../context/AuthContext";
import { Alert, AlertDescription } from "../components/ui/Alert";
import { Input } from "../components/ui/Input";
import { Button } from "../components/ui/Button";

const Login = () => {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { login, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // If already logged in, redirect to dashboard
  if (isAuthenticated) {
    return <Navigate to="/" />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!username || !password) {
      setError("Please enter both username and password");
      return;
    }

    setLoading(true);

    try {
      const success = await login(username, password);
      if (success) {
        navigate("/");
      } else {
        setError("Invalid username or password");
      }
    } catch (err) {
      setError("An error occurred during login. Please try again.");
      console.error("Login error:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page min-h-screen flex items-center justify-center relative overflow-hidden bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Gradient orbs */}
        <div className="login-orb login-orb-1 absolute -top-40 -right-40 w-80 h-80 bg-primary-500/20 rounded-full blur-3xl" />
        <div className="login-orb login-orb-2 absolute -bottom-40 -left-40 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        <div className="login-orb login-orb-3 absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary-600/10 rounded-full blur-3xl" />

        {/* Subtle grid pattern */}
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
            backgroundSize: '60px 60px'
          }}
        />
      </div>

      {/* Login card */}
      <div className="relative z-10 w-full max-w-md px-4">
        <div className="login-card bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-white/20 overflow-hidden">
          {/* Header with gradient accent */}
          <div className="relative px-8 pt-10 pb-6">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-primary via-primary-500 to-accent" />

            {/* Logo/Brand */}
            <div className="login-logo flex flex-col items-center mb-2">
              <div className="w-16 h-16 bg-gradient-to-br from-primary to-primary-700 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/25 mb-4">
                <span className="text-3xl font-bold text-white font-display">Y</span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white font-display tracking-tight">
                Welcome to YARS
              </h1>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Non Woven Bags Management System
              </p>
            </div>
          </div>

          {/* Form section */}
          <div className="px-8 pb-8">
            {error && (
              <Alert variant="destructive" className="mb-6 animate-fade-in">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="login-field space-y-2">
                <label htmlFor="username" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Username
                </label>
                <div className="login-input-wrapper relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                    <FaUser className="w-4 h-4" />
                  </div>
                  <Input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    disabled={loading}
                    className="pl-11 h-12 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                  />
                </div>
              </div>

              <div className="login-field space-y-2">
                <label htmlFor="password" className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Password
                </label>
                <div className="login-input-wrapper relative group">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none text-gray-400 group-focus-within:text-primary transition-colors">
                    <FaLock className="w-4 h-4" />
                  </div>
                  <Input
                    type={showPassword ? "text" : "password"}
                    id="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    disabled={loading}
                    className="pl-11 pr-12 h-12 bg-gray-50 dark:bg-gray-800/50 border-gray-200 dark:border-gray-700 focus:bg-white dark:focus:bg-gray-800 transition-colors"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 flex items-center pr-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 focus:outline-none transition-colors"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex="-1"
                  >
                    {showPassword ? <FaEyeSlash className="w-4 h-4" /> : <FaEye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <Button
                type="submit"
                className="login-button w-full h-12 text-base font-semibold bg-gradient-to-r from-primary to-primary-600 hover:from-primary-600 hover:to-primary-700 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300"
                disabled={loading}
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Sign in"
                )}
              </Button>
            </form>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-sm text-primary-200/60 mt-6">
          &copy; {new Date().getFullYear()} YARS. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default Login;
