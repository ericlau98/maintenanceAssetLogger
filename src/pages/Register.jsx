import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserPlus, Leaf, Sprout, TreePine, Flower2, Mail, Lock, User, ArrowRight, CheckCircle } from 'lucide-react';

export default function Register() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { signUp } = useAuth();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      navigate('/');
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Right Panel - Decorative (switched sides) */}
      <div className="hidden lg:block relative w-0 flex-1">
        <div className="absolute inset-0 bg-gradient-to-bl from-leaf-green-600 via-brand-green to-brand-dark-green">
          <div className="absolute inset-0 bg-black opacity-10"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-white p-12 max-w-lg">
              <div className="mb-8">
                <div className="flex space-x-2 mb-6">
                  <Sprout className="h-8 w-8 text-brand-light animate-bounce" />
                  <Leaf className="h-8 w-8 text-brand-light animate-bounce delay-100" />
                  <Flower2 className="h-8 w-8 text-brand-light animate-bounce delay-200" />
                </div>
                <h3 className="text-4xl font-bold mb-4">Join Our Growing Community</h3>
                <p className="text-xl text-white/90 leading-relaxed">
                  Start managing your greenhouse operations with precision and efficiency.
                </p>
              </div>
              
              <div className="space-y-4 border-t border-white/20 pt-8">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-brand-light mt-0.5" />
                  <div>
                    <p className="font-semibold">Complete Asset Management</p>
                    <p className="text-white/70 text-sm">Track all your greenhouse equipment and supplies</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-brand-light mt-0.5" />
                  <div>
                    <p className="font-semibold">Smart Inventory Control</p>
                    <p className="text-white/70 text-sm">Never run out of critical supplies again</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="h-5 w-5 text-brand-light mt-0.5" />
                  <div>
                    <p className="font-semibold">Team Collaboration</p>
                    <p className="text-white/70 text-sm">Work seamlessly with your greenhouse team</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          {/* Decorative patterns */}
          <div className="absolute top-0 left-0 right-0 h-64 bg-gradient-to-b from-black/20 to-transparent"></div>
          <div className="absolute bottom-10 left-10 opacity-20">
            <TreePine className="h-96 w-96 text-white transform -rotate-12" />
          </div>
        </div>
      </div>

      {/* Left Panel - Register Form */}
      <div className="flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 bg-white relative overflow-hidden">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 -mt-4 -ml-4 opacity-5">
          <Leaf className="h-72 w-72 text-brand-green transform -rotate-12" />
        </div>
        <div className="absolute bottom-0 right-0 -mb-8 -mr-8 opacity-5">
          <Flower2 className="h-56 w-56 text-brand-dark-green transform rotate-45" />
        </div>
        
        <div className="max-w-md w-full space-y-8 z-10">
          <div>
            <div className="flex justify-center mb-8">
              <div className="relative">
                <img src="/logo.jpg" alt="Great Lakes Greenhouses" className="h-32 w-auto" />
                <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 w-32 h-1 bg-gradient-to-r from-transparent via-brand-green to-transparent"></div>
              </div>
            </div>
            <h2 className="text-center text-4xl font-extrabold text-gray-900">
              Get Started Today
            </h2>
            <p className="mt-3 text-center text-lg text-gray-600">
              Create your account in just a few steps
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
                <label htmlFor="fullName" className="block text-sm font-semibold text-gray-700 mb-2">
                  Full Name
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <User className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    id="fullName"
                    name="fullName"
                    type="text"
                    required
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent hover:border-brand-light transition-all duration-200"
                    placeholder="John Doe"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
              </div>
              
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
                    autoComplete="new-password"
                    required
                    className="appearance-none relative block w-full pl-10 pr-3 py-3 border border-gray-300 placeholder-gray-400 text-gray-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent hover:border-brand-light transition-all duration-200"
                    placeholder="Minimum 6 characters"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="mt-2 flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    <div className={`h-2 w-2 rounded-full ${password.length >= 6 ? 'bg-green-500' : 'bg-gray-300'}`}></div>
                  </div>
                  <p className="text-xs text-gray-500">
                    Use a strong password with at least 6 characters
                  </p>
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
                    Creating account...
                  </div>
                ) : (
                  <div className="flex items-center">
                    Create Account
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </div>
                )}
              </button>
              
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-200"></div>
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-4 bg-white text-gray-500">Or</span>
                </div>
              </div>
              
              <div className="text-center">
                <span className="text-sm text-gray-600">
                  Already have an account?{' '}
                  <Link to="/login" className="font-semibold text-brand-green hover:text-brand-dark-green transition-colors">
                    Sign in instead →
                  </Link>
                </span>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}