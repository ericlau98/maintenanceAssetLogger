import { Link, Outlet, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { 
  Leaf, 
  Wrench, 
  Users, 
  LogOut, 
  Home,
  ClipboardList,
  Box
} from 'lucide-react';

export default function Layout() {
  const { user, profile, signOut, isAdmin } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-brand-light/20">
      <nav className="bg-white shadow-lg border-b border-brand-light">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-20">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img src="/logo.jpg" alt="Great Lakes Greenhouses" className="h-12 w-auto" />
              </div>
              <div className="hidden sm:ml-8 sm:flex sm:space-x-6">
                <Link
                  to="/"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    location.pathname === '/' 
                      ? 'text-brand-green border-brand-green' 
                      : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                  }`}
                >
                  <Home className="h-4 w-4 mr-1" />
                  Dashboard
                </Link>
                <Link
                  to="/assets"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    location.pathname === '/assets' 
                      ? 'text-brand-green border-brand-green' 
                      : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                  }`}
                >
                  <Wrench className="h-4 w-4 mr-1" />
                  Assets
                </Link>
                <Link
                  to="/inventory"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    location.pathname === '/inventory' 
                      ? 'text-brand-green border-brand-green' 
                      : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                  }`}
                >
                  <Box className="h-4 w-4 mr-1" />
                  Inventory
                </Link>
                <Link
                  to="/logs"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                    location.pathname === '/logs' 
                      ? 'text-brand-green border-brand-green' 
                      : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                  }`}
                >
                  <ClipboardList className="h-4 w-4 mr-1" />
                  Logs
                </Link>
                {isAdmin && (
                  <Link
                    to="/users"
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-colors ${
                      location.pathname === '/users' 
                        ? 'text-brand-green border-brand-green' 
                        : 'text-gray-700 border-transparent hover:text-brand-dark-green hover:border-brand-light'
                    }`}
                  >
                    <Users className="h-4 w-4 mr-1" />
                    Users
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <div className="mr-4">
                <p className="text-sm font-medium text-gray-900">
                  {profile?.full_name || user?.email}
                </p>
                {isAdmin && (
                  <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium bg-brand-light text-brand-dark-green rounded">
                    <Leaf className="h-3 w-3 mr-1" />
                    Admin
                  </span>
                )}
              </div>
              <button
                onClick={handleSignOut}
                className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-lg text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500 transition-all duration-200"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <Outlet />
      </main>
    </div>
  );
}