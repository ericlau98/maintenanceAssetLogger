import { Navigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertTriangle, RefreshCw } from 'lucide-react';

export default function PrivateRoute({ children, adminOnly = false }) {
  const { user, loading, isAdmin, connectionError, retryConnection } = useAuth();

  if (connectionError && !loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="bg-white p-8 rounded-lg shadow-lg max-w-md w-full mx-4">
          <div className="flex items-center justify-center mb-4">
            <div className="bg-red-100 p-3 rounded-full">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
          </div>
          <h2 className="text-xl font-semibold text-center mb-2">Connection Error</h2>
          <p className="text-gray-600 text-center mb-6">
            Unable to connect to the server. Please check your internet connection and try again.
          </p>
          <button
            onClick={retryConnection}
            className="w-full flex items-center justify-center gap-2 bg-brand-green text-white px-4 py-2 rounded-lg hover:bg-brand-dark-green transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50">
        <div className="relative">
          <div className="animate-spin rounded-full h-16 w-16 border-t-4 border-b-4 border-brand-green"></div>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-8 w-8 bg-white rounded-full"></div>
          </div>
        </div>
        <p className="mt-4 text-gray-600">Loading your workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" />;
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" />;
  }

  return children;
}