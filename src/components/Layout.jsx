import { useState } from 'react';
import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Leaf, 
  Wrench, 
  Users, 
  LogOut, 
  Home,
  ClipboardList,
  Box,
  Menu,
  X,
  Ticket
} from 'lucide-react';

export default function Layout() {
  const { user, profile, signOut, isAdmin, isAnyAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      setMobileMenuOpen(false); // Close mobile menu if open
      
      // Call signOut with a timeout to prevent hanging
      const signOutPromise = signOut();
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Sign out timeout')), 5000)
      );
      
      try {
        const { error } = await Promise.race([signOutPromise, timeoutPromise]);
        if (error) {
          console.error('Sign out error:', error);
        }
      } catch (timeoutError) {
        console.error('Sign out timed out:', timeoutError);
      }
      
      // Always redirect to login regardless of result
      window.location.href = '/login';
    } catch (err) {
      console.error('Sign out error:', err);
      // Force reload even on error to clear state
      window.location.href = '/login';
    }
  };

  const navLinks = [
    { to: '/', label: 'Dashboard', icon: Home },
    { to: '/tickets', label: 'Tickets', icon: Ticket },
    { to: '/assets', label: 'Assets', icon: Wrench },
    { to: '/inventory', label: 'Inventory', icon: Box },
    { to: '/logs', label: 'Logs', icon: ClipboardList },
    ...(isAnyAdmin ? [{ to: '/users', label: 'Users', icon: Users }] : [])
  ];

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-brand-light/20">
      <nav className="bg-white shadow-lg border-b border-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 sm:h-20">
            <div className="flex items-center">
              <div className="flex-shrink-0 flex items-center">
                <img src="/logo.jpg" alt="Great Lakes Greenhouses" className="h-10 sm:h-12 w-auto" />
              </div>
              
              {/* Desktop Navigation */}
              <div className="hidden md:ml-8 md:flex md:space-x-6">
                {navLinks.map(({ to, label, icon: Icon }) => (
                  <Link
                    key={to}
                    to={to}
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                      location.pathname === to 
                        ? 'text-brand-green border-brand-green' 
                        : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                    }`}
                  >
                    <Icon className="h-4 w-4 mr-1" />
                    {label}
                  </Link>
                ))}
              </div>
            </div>

            {/* Desktop User Info */}
            <div className="hidden md:flex items-center space-x-4">
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.full_name || user?.email}
                </p>
                {isAnyAdmin && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-brand-light text-brand-dark-green rounded">
                    <Leaf className="h-3 w-3 mr-1" />
                    {profile?.role === 'global_admin' ? 'Global Admin' : 
                     profile?.role === 'maintenance_admin' ? 'Maintenance Admin' :
                     profile?.role === 'electrical_admin' ? 'Electrical Admin' : 'Admin'}
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-3 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-1" />
                <span className="hidden lg:inline">Sign Out</span>
              </button>
            </div>

            {/* Mobile menu button */}
            <div className="flex items-center md:hidden">
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="inline-flex items-center justify-center p-2 rounded-md text-gray-700 hover:text-brand-dark-green hover:bg-brand-light focus:outline-none focus:ring-2 focus:ring-inset focus:ring-brand-green"
              >
                <span className="sr-only">Open main menu</span>
                {mobileMenuOpen ? (
                  <X className="block h-6 w-6" />
                ) : (
                  <Menu className="block h-6 w-6" />
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="md:hidden">
            <div className="pt-2 pb-3 space-y-1">
              {navLinks.map(({ to, label, icon: Icon }) => (
                <Link
                  key={to}
                  to={to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block pl-3 pr-4 py-2 border-l-4 text-base font-medium transition-colors ${
                    location.pathname === to
                      ? 'bg-brand-light border-brand-green text-brand-dark-green'
                      : 'border-transparent text-gray-700 hover:bg-gray-50 hover:border-gray-300 hover:text-gray-800'
                  }`}
                >
                  <span className="flex items-center">
                    <Icon className="h-5 w-5 mr-2" />
                    {label}
                  </span>
                </Link>
              ))}
            </div>
            <div className="pt-4 pb-3 border-t border-gray-200">
              <div className="flex items-center px-4">
                <div className="flex-1">
                  <div className="text-base font-medium text-gray-800">
                    {profile?.full_name || user?.email}
                  </div>
                  {isAnyAdmin && (
                    <span className="inline-flex items-center px-2 py-0.5 mt-1 text-xs font-medium bg-brand-light text-brand-dark-green rounded">
                      <Leaf className="h-3 w-3 mr-1" />
                      {profile?.role === 'global_admin' ? 'Global Admin' : 
                       profile?.role === 'maintenance_admin' ? 'Maintenance Admin' :
                       profile?.role === 'electrical_admin' ? 'Electrical Admin' : 'Admin'}
                    </span>
                  )}
                </div>
              </div>
              <div className="mt-3 space-y-1">
                <button
                  onClick={handleSignOut}
                  className="block w-full text-left px-4 py-2 text-base font-medium text-red-700 hover:bg-red-50 transition-colors"
                >
                  <span className="flex items-center">
                    <LogOut className="h-5 w-5 mr-2" />
                    Sign Out
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}