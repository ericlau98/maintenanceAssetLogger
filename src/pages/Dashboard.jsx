import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Package, Box, ClipboardList, AlertCircle, Leaf, TrendingUp, Clock, Wrench, MessageSquare, Eye, User, Activity, Ticket } from 'lucide-react';

export default function Dashboard() {
  const { user, isAdmin } = useAuth();
  const [stats, setStats] = useState({
    totalAssets: 0,
    activeAssets: 0,
    inventoryItems: 0,
    lowStockItems: 0,
    recentLogs: 0,
    openTickets: 0,
  });
  const [recentLogs, setRecentLogs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      // Check session before making queries
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        // Try to refresh
        const { data: { session: newSession } } = await supabase.auth.refreshSession();
        if (!newSession) {
          setLoading(false);
          return;
        }
      }

      // Build the logs query based on user role
      let logsQuery = supabase
        .from('maintenance_logs')
        .select(`
          id,
          log_type,
          description,
          created_at,
          asset_id,
          user_id,
          assets (
            name,
            serial_number
          ),
          profiles (
            full_name,
            email
          )
        `)
        .order('created_at', { ascending: false })
        .limit(5);
      
      // If not admin, only show user's own logs
      if (!isAdmin && user) {
        logsQuery = logsQuery.eq('user_id', user.id);
      }

      const [assets, inventory, logs, recentLogsData, tickets] = await Promise.all([
        supabase.from('assets').select('status', { count: 'exact' }),
        supabase.from('inventory').select('quantity, min_quantity', { count: 'exact' }),
        supabase
          .from('maintenance_logs')
          .select('id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
        logsQuery,
        supabase
          .from('tickets')
          .select('status', { count: 'exact' })
          .in('status', ['to_do', 'in_progress', 'review'])
      ]);

      // Check for auth errors and retry if needed
      if (assets.error?.code === 'PGRST301' || inventory.error?.code === 'PGRST301' || 
          logs.error?.code === 'PGRST301' || recentLogsData.error?.code === 'PGRST301' ||
          tickets.error?.code === 'PGRST301') {
        console.log('Auth error detected, refreshing session...');
        const { data: { session: refreshedSession } } = await supabase.auth.refreshSession();
        if (refreshedSession) {
          // Retry the fetch
          return fetchDashboardStats();
        }
      }

      const activeAssets = assets.data?.filter(a => a.status === 'active').length || 0;
      const lowStock = inventory.data?.filter(i => i.quantity <= i.min_quantity).length || 0;

      setStats({
        totalAssets: assets.count || 0,
        activeAssets,
        inventoryItems: inventory.count || 0,
        lowStockItems: lowStock,
        recentLogs: logs.data?.length || 0,
        openTickets: tickets.count || 0,
      });

      setRecentLogs(recentLogsData.data || []);
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
      // Try to refresh session on error
      await supabase.auth.refreshSession();
    } finally {
      setLoading(false);
    }
  };

  const getLogTypeIcon = (type) => {
    switch (type) {
      case 'maintenance':
        return <Wrench className="h-4 w-4" />;
      case 'repair':
        return <Wrench className="h-4 w-4" />;
      case 'inspection':
        return <Eye className="h-4 w-4" />;
      case 'comment':
        return <MessageSquare className="h-4 w-4" />;
      default:
        return <ClipboardList className="h-4 w-4" />;
    }
  };

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'maintenance':
        return 'text-blue-600 bg-blue-50';
      case 'repair':
        return 'text-red-600 bg-red-50';
      case 'inspection':
        return 'text-green-600 bg-green-50';
      case 'comment':
        return 'text-gray-600 bg-gray-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const formatTimeAgo = (date) => {
    const now = new Date();
    const logDate = new Date(date);
    const diffInSeconds = Math.floor((now - logDate) / 1000);
    
    if (diffInSeconds < 60) return 'just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)} min ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)} hours ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)} days ago`;
    return logDate.toLocaleDateString();
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Your Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor and manage your assets and inventory</p>
      </div>
      
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-brand-light rounded-lg p-3">
                <Package className="h-6 w-6 text-brand-dark-green" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Total Assets
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.totalAssets}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-brand-light to-leaf-green-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-brand-dark-green flex items-center">
                <Activity className="h-4 w-4 mr-1" />
                {stats.activeAssets} active
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-brand-light rounded-lg p-3">
                <Box className="h-6 w-6 text-brand-dark-green" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Inventory Items
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.inventoryItems}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-brand-light to-leaf-green-50 px-5 py-3">
            <div className="text-sm">
              {stats.lowStockItems > 0 ? (
                <span className="font-medium text-red-600 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-1" />
                  {stats.lowStockItems} low stock
                </span>
              ) : (
                <span className="font-medium text-brand-dark-green flex items-center">
                  <TrendingUp className="h-4 w-4 mr-1" />
                  Stock levels OK
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-brand-light rounded-lg p-3">
                <ClipboardList className="h-6 w-6 text-brand-dark-green" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Recent Logs
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.recentLogs}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-brand-light to-leaf-green-50 px-5 py-3">
            <div className="text-sm">
              <span className="font-medium text-gray-600">
                Last 7 days
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow-lg rounded-xl hover:shadow-xl transition-shadow duration-200">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0 bg-brand-light rounded-lg p-3">
                <Ticket className="h-6 w-6 text-brand-dark-green" />
              </div>
              <div className="ml-5 w-0 flex-1">
                <dl>
                  <dt className="text-sm font-medium text-gray-500 truncate">
                    Open Tickets
                  </dt>
                  <dd className="text-lg font-medium text-gray-900">
                    {stats.openTickets}
                  </dd>
                </dl>
              </div>
            </div>
          </div>
          <div className="bg-gradient-to-r from-brand-light to-leaf-green-50 px-5 py-3">
            <div className="text-sm">
              <Link to="/tickets" className="font-medium text-brand-dark-green hover:text-brand-green flex items-center transition-colors">
                <span>View all tickets</span>
                <span className="ml-1">→</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 sm:mt-8">
        <div className="bg-white shadow-lg rounded-xl p-4 sm:p-6">
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Leaf className="h-5 w-5 mr-2 text-brand-green" />
            Quick Actions
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Link to="/assets" className="block p-4 sm:p-5 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group touch-manipulation">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green text-sm sm:text-base">→ View Assets</span>
            </Link>
            <Link to="/inventory" className="block p-4 sm:p-5 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group touch-manipulation">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green text-sm sm:text-base">→ View Inventory</span>
            </Link>
            <Link to="/logs" className="block p-4 sm:p-5 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group touch-manipulation">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green text-sm sm:text-base">→ Create Log</span>
            </Link>
          </div>
        </div>
      </div>

      {/* Recent Logs Section - Full Width */}
      <div className="mt-8">
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-brand-green" />
            {isAdmin ? 'Recent Maintenance Logs' : 'My Recent Logs'}
          </h2>
          
          {recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getLogTypeColor(log.log_type)}`}>
                          {getLogTypeIcon(log.log_type)}
                          <span className="ml-1">{log.log_type}</span>
                        </span>
                        <span className="text-sm font-medium text-gray-900">
                          {log.assets?.name || 'Unknown Asset'}
                        </span>
                        {log.assets?.serial_number && (
                          <span className="text-sm text-gray-500">
                            ({log.assets.serial_number})
                          </span>
                        )}
                      </div>
                      
                      <p className="text-sm text-gray-700 line-clamp-2 mb-2">
                        {log.description}
                      </p>
                      
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        {isAdmin && (
                          <div className="flex items-center">
                            <User className="h-3 w-3 mr-1" />
                            <span>{log.profiles?.full_name || log.profiles?.email || 'Unknown User'}</span>
                          </div>
                        )}
                        <div className="flex items-center">
                          <Clock className="h-3 w-3 mr-1" />
                          <span>{formatTimeAgo(log.created_at)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              
              <div className="pt-3 border-t">
                <Link 
                  to="/logs" 
                  className="text-sm font-medium text-brand-green hover:text-brand-dark-green transition-colors flex items-center"
                >
                  View all logs
                  <span className="ml-1">→</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">
              <ClipboardList className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p>{isAdmin ? 'No maintenance logs yet' : 'You haven\'t created any logs yet'}</p>
              <Link 
                to="/logs" 
                className="mt-2 inline-block text-sm font-medium text-brand-green hover:text-brand-dark-green transition-colors"
              >
                Create your first log →
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}