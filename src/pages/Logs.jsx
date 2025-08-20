import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Search, Wrench, MessageSquare, CheckCircle, Eye } from 'lucide-react';
import LogForm from '../components/LogForm';

export default function Logs() {
  const { user, isAdmin } = useAuth();
  const [logs, setLogs] = useState([]);
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingLog, setEditingLog] = useState(null);
  const [filterAssetId, setFilterAssetId] = useState('');
  const [filterType, setFilterType] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [logsResponse, assetsResponse, profilesResponse] = await Promise.all([
        supabase
          .from('maintenance_logs')
          .select('*')
          .order('created_at', { ascending: false }),
        supabase.from('assets').select('id, name, serial_number'),
        supabase.from('profiles').select('id, full_name, email'),
      ]);

      if (logsResponse.error) throw logsResponse.error;
      if (assetsResponse.error) throw assetsResponse.error;

      const logsWithDetails = logsResponse.data.map(log => {
        const asset = assetsResponse.data.find(a => a.id === log.asset_id);
        const profile = profilesResponse.data?.find(p => p.id === log.user_id);
        return {
          ...log,
          asset_name: asset?.name || 'Unknown Asset',
          asset_serial: asset?.serial_number,
          user_name: profile?.full_name || profile?.email || 'Unknown User',
        };
      });

      setLogs(logsWithDetails);
      setAssets(assetsResponse.data);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this log?')) return;

    try {
      const { error } = await supabase
        .from('maintenance_logs')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setLogs(logs.filter(l => l.id !== id));
    } catch (error) {
      console.error('Error deleting log:', error);
      alert('Failed to delete log');
    }
  };

  const handleEdit = (log) => {
    setEditingLog(log);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingLog(null);
    fetchData();
  };

  const canEditLog = (log) => {
    return log.user_id === user?.id || isAdmin;
  };

  const canDeleteLog = (log) => {
    return log.user_id === user?.id || isAdmin;
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
        return <CheckCircle className="h-4 w-4" />;
    }
  };

  const getLogTypeColor = (type) => {
    switch (type) {
      case 'maintenance':
        return 'bg-blue-100 text-blue-800';
      case 'repair':
        return 'bg-red-100 text-red-800';
      case 'inspection':
        return 'bg-green-100 text-green-800';
      case 'comment':
        return 'bg-gray-100 text-gray-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      log.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.asset_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.user_name.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesAsset = !filterAssetId || log.asset_id === filterAssetId;
    const matchesType = !filterType || log.log_type === filterType;
    
    return matchesSearch && matchesAsset && matchesType;
  });

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div className="px-4 sm:px-0">
      <div className="sm:flex sm:items-center">
        <div className="sm:flex-auto">
          <h1 className="text-2xl font-semibold text-gray-900">Maintenance Logs</h1>
          <p className="mt-2 text-sm text-gray-700">
            Track maintenance, repairs, and inspections on assets.
          </p>
        </div>
        <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 sm:w-auto"
          >
            <Plus className="h-4 w-4 mr-1" />
            Add Log
          </button>
        </div>
      </div>

      <div className="mt-4 space-y-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
            placeholder="Search logs..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <select
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={filterAssetId}
            onChange={(e) => setFilterAssetId(e.target.value)}
          >
            <option value="">All Assets</option>
            {assets.map(asset => (
              <option key={asset.id} value={asset.id}>
                {asset.name} {asset.serial_number && `(${asset.serial_number})`}
              </option>
            ))}
          </select>

          <select
            className="block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            value={filterType}
            onChange={(e) => setFilterType(e.target.value)}
          >
            <option value="">All Types</option>
            <option value="maintenance">Maintenance</option>
            <option value="repair">Repair</option>
            <option value="inspection">Inspection</option>
            <option value="comment">Comment</option>
          </select>
        </div>
      </div>

      <div className="mt-8 space-y-4">
        {filteredLogs.map((log) => (
          <div key={log.id} className="bg-white shadow rounded-lg p-6">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center space-x-3">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getLogTypeColor(log.log_type)}`}>
                    {getLogTypeIcon(log.log_type)}
                    <span className="ml-1">{log.log_type}</span>
                  </span>
                  <h3 className="text-lg font-medium text-gray-900">
                    {log.asset_name}
                  </h3>
                  {log.asset_serial && (
                    <span className="text-sm text-gray-500">
                      ({log.asset_serial})
                    </span>
                  )}
                </div>
                
                <p className="mt-2 text-gray-700">{log.description}</p>
                
                {log.materials_used && log.materials_used.length > 0 && (
                  <div className="mt-3">
                    <h4 className="text-sm font-medium text-gray-900">Materials Used:</h4>
                    <ul className="mt-1 text-sm text-gray-600 list-disc list-inside">
                      {log.materials_used.map((material, index) => (
                        <li key={index}>{material}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                <div className="mt-4 text-sm text-gray-500">
                  <span>By {log.user_name}</span>
                  <span className="mx-2">•</span>
                  <span>{new Date(log.created_at).toLocaleDateString()}</span>
                </div>
              </div>
              
              {(canEditLog(log) || canDeleteLog(log)) && (
                <div className="flex space-x-2 ml-4">
                  {canEditLog(log) && (
                    <button
                      onClick={() => handleEdit(log)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                  )}
                  {canDeleteLog(log) && (
                    <button
                      onClick={() => handleDelete(log.id)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        
        {filteredLogs.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No maintenance logs found.
          </div>
        )}
      </div>

      {showForm && (
        <LogForm
          log={editingLog}
          assets={assets}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}