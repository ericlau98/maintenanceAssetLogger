import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Package, Box, ClipboardList, AlertCircle, Leaf, Activity, TrendingUp } from 'lucide-react';

export default function Dashboard() {
  const [stats, setStats] = useState({
    totalAssets: 0,
    activeAssets: 0,
    inventoryItems: 0,
    lowStockItems: 0,
    recentLogs: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [assets, inventory, logs] = await Promise.all([
        supabase.from('assets').select('status', { count: 'exact' }),
        supabase.from('inventory').select('quantity, min_quantity', { count: 'exact' }),
        supabase
          .from('maintenance_logs')
          .select('id')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      ]);

      const activeAssets = assets.data?.filter(a => a.status === 'active').length || 0;
      const lowStock = inventory.data?.filter(i => i.quantity <= i.min_quantity).length || 0;

      setStats({
        totalAssets: assets.count || 0,
        activeAssets,
        inventoryItems: inventory.count || 0,
        lowStockItems: lowStock,
        recentLogs: logs.data?.length || 0,
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Welcome to Your Dashboard</h1>
        <p className="mt-2 text-gray-600">Monitor and manage your greenhouse assets and inventory</p>
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
      </div>

      <div className="mt-8 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Leaf className="h-5 w-5 mr-2 text-brand-green" />
            Quick Actions
          </h2>
          <div className="space-y-3">
            <Link to="/assets" className="block p-4 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green">→ Add New Asset</span>
            </Link>
            <Link to="/inventory" className="block p-4 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green">→ Add Inventory Item</span>
            </Link>
            <Link to="/logs" className="block p-4 border-2 border-brand-light rounded-lg hover:bg-brand-light hover:border-brand-green transition-all duration-200 group">
              <span className="font-medium text-gray-900 group-hover:text-brand-dark-green">→ Create Maintenance Log</span>
            </Link>
          </div>
        </div>

        <div className="bg-white shadow-lg rounded-xl p-6">
          <h2 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <Activity className="h-5 w-5 mr-2 text-brand-green" />
            System Status
          </h2>
          <div className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-brand-light/30 rounded-lg">
              <span className="font-medium">Database Connection</span>
              <span className="text-brand-dark-green font-semibold flex items-center">
                <span className="h-2 w-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
                Connected
              </span>
            </div>
            <div className="flex justify-between items-center p-3 bg-brand-light/30 rounded-lg">
              <span className="font-medium">Last Sync</span>
              <span className="text-gray-600">Just now</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}