import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X } from 'lucide-react';

export default function AssetForm({ asset, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    name: asset?.name || '',
    description: asset?.description || '',
    serial_number: asset?.serial_number || '',
    category: asset?.category || '',
    location: asset?.location || '',
    status: asset?.status || 'active',
    purchase_date: asset?.purchase_date || '',
    purchase_price: asset?.purchase_price || '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        purchase_price: formData.purchase_price ? parseFloat(formData.purchase_price) : null,
      };

      if (asset) {
        const { error } = await supabase
          .from('assets')
          .update(data)
          .eq('id', asset.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('assets')
          .insert([{ ...data, created_by: user.id }]);
        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving asset:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-900 bg-opacity-50 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
        <div className="flex justify-between items-center p-6 border-b border-brand-light bg-gradient-to-r from-white to-brand-light/30">
          <h2 className="text-xl font-semibold">
            {asset ? 'Edit Asset' : 'Add New Asset'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-500"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                name="name"
                required
                value={formData.name}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Serial Number
              </label>
              <input
                type="text"
                name="serial_number"
                value={formData.serial_number}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Category
              </label>
              <input
                type="text"
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Location
              </label>
              <input
                type="text"
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Status
              </label>
              <select
                name="status"
                value={formData.status}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              >
                <option value="active">Active</option>
                <option value="maintenance">Maintenance</option>
                <option value="retired">Retired</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purchase Date
              </label>
              <input
                type="date"
                name="purchase_date"
                value={formData.purchase_date}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">
                Purchase Price
              </label>
              <input
                type="number"
                step="0.01"
                name="purchase_price"
                value={formData.purchase_price}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700">
                Description
              </label>
              <textarea
                name="description"
                rows={3}
                value={formData.description}
                onChange={handleChange}
                className="mt-1 block w-full rounded-lg border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green sm:text-sm transition-all duration-200"
              />
            </div>
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 transition-all duration-200"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-lg border border-transparent bg-gradient-to-r from-brand-green to-brand-dark-green px-4 py-2 text-sm font-medium text-white shadow-lg hover:from-brand-dark-green hover:to-leaf-green-700 focus:outline-none focus:ring-2 focus:ring-brand-green focus:ring-offset-2 disabled:opacity-50 transition-all duration-200"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}