import { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { Plus, Edit2, Trash2, Search, Image } from 'lucide-react';
import AssetForm from '../components/AssetForm';

export default function Assets() {
  const { isAdmin } = useAuth();
  const [assets, setAssets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingAsset, setEditingAsset] = useState(null);

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const { data, error } = await supabase
        .from('assets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAssets(data || []);
    } catch (error) {
      console.error('Error fetching assets:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this asset?')) return;

    try {
      const { error } = await supabase
        .from('assets')
        .delete()
        .eq('id', id);

      if (error) throw error;
      setAssets(assets.filter(a => a.id !== id));
    } catch (error) {
      console.error('Error deleting asset:', error);
      alert('Failed to delete asset');
    }
  };

  const handleEdit = (asset) => {
    setEditingAsset(asset);
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
    setEditingAsset(null);
    fetchAssets();
  };

  const filteredAssets = assets.filter(asset =>
    asset.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.serial_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    asset.category?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

  return (
    <div>
      <div className="sm:flex sm:items-center mb-4">
        <div className="sm:flex-auto">
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Assets</h1>
          <p className="mt-2 text-sm text-gray-700">
            A list of all assets including their status and details.
          </p>
        </div>
        {isAdmin && (
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <button
              onClick={() => setShowForm(true)}
              className="w-full sm:w-auto inline-flex items-center justify-center rounded-lg border border-transparent bg-gradient-to-r from-brand-green to-brand-dark-green px-4 py-3 sm:py-2 text-sm font-medium text-white shadow-lg hover:from-brand-dark-green hover:to-leaf-green-700 focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 transition-all duration-200"
            >
              <Plus className="h-4 w-4 mr-1" />
              Add Asset
            </button>
          </div>
        )}
      </div>

      <div className="mt-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-brand-green focus:border-transparent sm:text-sm transition-all duration-200"
            placeholder="Search assets..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Mobile Card View */}
      <div className="block sm:hidden space-y-3">
        {filteredAssets.map((asset) => (
          <div key={asset.id} className="bg-white shadow rounded-lg p-4 border border-gray-200">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div className="flex items-center mb-2">
                  {asset.image_url ? (
                    <img
                      src={asset.image_url}
                      alt={asset.name}
                      className="h-12 w-12 object-cover rounded-lg border border-gray-200 mr-3"
                    />
                  ) : (
                    <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center mr-3">
                      <Image className="h-6 w-6 text-gray-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-sm font-medium text-gray-900">{asset.name}</h3>
                    <p className="text-xs text-gray-500">{asset.serial_number}</p>
                  </div>
                </div>
                <div className="space-y-1">
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 w-20">Category:</span>
                    <span className="text-gray-900">{asset.category}</span>
                  </div>
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 w-20">Status:</span>
                    <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                      asset.status === 'active' 
                        ? 'bg-brand-light text-brand-dark-green'
                        : asset.status === 'maintenance'
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {asset.status}
                    </span>
                  </div>
                  <div className="flex items-center text-xs">
                    <span className="text-gray-500 w-20">Location:</span>
                    <span className="text-gray-900">{asset.location}</span>
                  </div>
                </div>
              </div>
              {isAdmin && (
                <div className="flex space-x-2 ml-2">
                  <button
                    onClick={() => handleEdit(asset)}
                    className="p-2 text-brand-green hover:text-brand-dark-green transition-colors"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(asset.id)}
                    className="p-2 text-red-600 hover:text-red-900"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden sm:block mt-8">
        <div className="-my-2 -mx-4 overflow-x-auto sm:-mx-6 lg:-mx-8">
          <div className="inline-block min-w-full py-2 align-middle md:px-6 lg:px-8">
            <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 md:rounded-lg">
              <table className="min-w-full divide-y divide-gray-300">
                <thead className="bg-gradient-to-r from-brand-light to-leaf-green-50">
                  <tr>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Image
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Name
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Serial Number
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Category
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900">
                      Location
                    </th>
                    {isAdmin && (
                      <th className="relative py-3.5 pl-3 pr-4 sm:pr-6">
                        <span className="sr-only">Actions</span>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id}>
                      <td className="whitespace-nowrap px-3 py-4">
                        {asset.image_url ? (
                          <img
                            src={asset.image_url}
                            alt={asset.name}
                            className="h-12 w-12 object-cover rounded-lg border border-gray-200"
                          />
                        ) : (
                          <div className="h-12 w-12 bg-gray-100 rounded-lg flex items-center justify-center">
                            <Image className="h-6 w-6 text-gray-400" />
                          </div>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-900">
                        {asset.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {asset.serial_number}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {asset.category}
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm">
                        <span className={`inline-flex rounded-full px-2 text-xs font-semibold leading-5 ${
                          asset.status === 'active' 
                            ? 'bg-brand-light text-brand-dark-green'
                            : asset.status === 'maintenance'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-gray-100 text-gray-800'
                        }`}>
                          {asset.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500">
                        {asset.location}
                      </td>
                      {isAdmin && (
                        <td className="relative whitespace-nowrap py-4 pl-3 pr-4 text-right text-sm font-medium sm:pr-6">
                          <button
                            onClick={() => handleEdit(asset)}
                            className="text-brand-green hover:text-brand-dark-green mr-4 transition-colors"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(asset.id)}
                            className="text-red-600 hover:text-red-900"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {showForm && (
        <AssetForm
          asset={editingAsset}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}