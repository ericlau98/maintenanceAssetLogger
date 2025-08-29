import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, Leaf, Sprout, TreePine, Flower2, Mail, Lock, ArrowRight } from 'lucide-react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signIn } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error } = await signIn(email, password);
      
      if (error) {
        console.error('Login error:', error);
        setError(error.message);
        setLoading(false);
      } else if (data?.user) {
        console.log('Login successful, redirecting...');
        // Use window.location for a full page reload to ensure auth state is fresh
        window.location.href = '/';
      } else {
        setError('Login failed. Please try again.');
        setLoading(false);
      }
    } catch (err) {
      console.error('Login exception:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left Panel - Login Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white relative">
        {/* Decorative elements */}
        <div className="absolute top-0 right-0 -mt-4 -mr-4 opacity-10">
          <Leaf className="h-64 w-64 text-brand-green transform rotate-12" />
        </div>
        <div className="absolute bottom-0 left-0 -mb-8 -ml-8 opacity-10">
          <Sprout className="h-48 w-48 text-brand-dark-green transform -rotate-12" />
        </div>
        
        <div className="max-w-md w-full space-y-8 z-10">
          <div>
            <div className="flex justify-center mb-8">
              <div className="relative">
                <img src="/logo.jpg" alt="Great Lakes Greenhouses" className="h-32 w-auto" />
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-24 h-1 bg-gradient-to-r from-transparent via-brand-green to-transparent"></div>
              </div>
            </div>
            <h2 className="text-center text-4xl font-extrabold text-gray-900">
              Welcome Back
            </h2>
            <p className="mt-3 text-center text-lg text-gray-600">
              Sign in to manage your inventory and assets
            </p>
          </div>
          
          <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 text-red-700 px-4 py-3 rounded-lg animate-pulse">
                <p className="font-medium">{error}</p>
              </div>
            )}
            
            <div className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Mail className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    required
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent hover:border-brand-light transition-all duration-200"
                    placeholder="you@greatlakes.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                  />
                </div>
              </div>
              
              <div>
                <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                  Password
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Lock className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent hover:border-brand-light transition-all duration-200"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-4 px-4 border border-transparent text-base font-bold rounded-xl text-white bg-gradient-to-r from-brand-green to-brand-dark-green hover:from-brand-dark-green hover:to-leaf-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green disabled:opacity-50 transition-all duration-300 shadow-xl hover:shadow-2xl transform hover:-translate-y-0.5"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-3"></div>
                    Signing in...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Sign In
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
              
              <div className="flex items-center justify-center">
                <div className="text-sm">
                  <a href="#" className="font-medium text-brand-green hover:text-brand-dark-green transition-colors">
                    Forgot your password?
                  </a>
                </div>
              </div>
            </div>
          </form>
        </div>
      </div>

      {/* Right Panel - Decorative */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-br from-brand-green via-brand-dark-green to-leaf-green-800">
          <div className="absolute inset-0 bg-black opacity-20"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white p-12 max-w-lg">
              <div className="mb-8">
                <div className="flex space-x-2 mb-6">
                  <Leaf className="h-8 w-8 text-brand-light animate-pulse" />
                  <Flower2 className="h-8 w-8 text-brand-light animate-pulse delay-75" />
                  <TreePine className="h-8 w-8 text-brand-light animate-pulse delay-150" />
                </div>
                <h3 className="text-4xl font-bold mb-4">Growing Excellence Together</h3>
                <p className="text-xl text-white/90 leading-relaxed">
                  Track assets, manage inventory and keep track of all your maintenance logs in this IMS (Inventory Management System).
                </p>
              </div>
              
              <div className="space-y-4 border-t border-white/20 pt-8">
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-brand-light rounded-full mt-2"></div>
                  <p className="text-white/80">Real-time asset tracking and monitoring</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-brand-light rounded-full mt-2"></div>
                  <p className="text-white/80">Comprehensive maintenance logging</p>
                </div>
                <div className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-brand-light rounded-full mt-2"></div>
                  <p className="text-white/80">Intelligent inventory management</p>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative patterns */}
          <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-black/30 to-transparent"></div>
          <div className="absolute top-10 right-10 opacity-20">
            <Leaf className="h-96 w-96 text-white transform rotate-45" />
          </div>
        </div>
      </div>
    </div>
  );
}