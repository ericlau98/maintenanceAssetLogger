import { useState, useEffect } from 'react';
import { getDaysUntilExpiry, isTokenValid } from '../lib/tokenManager';
import { Clock, AlertCircle } from 'lucide-react';

export default function SessionStatus() {
  const [daysLeft, setDaysLeft] = useState(0);
  const [showWarning, setShowWarning] = useState(false);

  useEffect(() => {
    const checkToken = () => {
      if (isTokenValid()) {
        const days = getDaysUntilExpiry();
        setDaysLeft(days);
        setShowWarning(days <= 2); // Show warning when 2 days or less
      }
    };

    checkToken();
    const interval = setInterval(checkToken, 60000); // Check every minute

    return () => clearInterval(interval);
  }, []);

  if (!isTokenValid() || daysLeft > 2) {
    return null; // Don't show if token invalid or more than 2 days left
  }

  return (
    <div className={`fixed bottom-4 right-4 p-4 rounded-lg shadow-lg ${
      daysLeft <= 1 ? 'bg-red-50 border border-red-200' : 'bg-yellow-50 border border-yellow-200'
    }`}>
      <div className="flex items-center space-x-2">
        {daysLeft <= 1 ? (
          <AlertCircle className="h-5 w-5 text-red-600" />
        ) : (
          <Clock className="h-5 w-5 text-yellow-600" />
        )}
        <div>
          <p className={`text-sm font-medium ${
            daysLeft <= 1 ? 'text-red-900' : 'text-yellow-900'
          }`}>
            Session expires in {daysLeft} {daysLeft === 1 ? 'day' : 'days'}
          </p>
          <p className={`text-xs ${
            daysLeft <= 1 ? 'text-red-700' : 'text-yellow-700'
          }`}>
            Please sign in again to extend your session
          </p>
        </div>
      </div>
    </div>
  );
}