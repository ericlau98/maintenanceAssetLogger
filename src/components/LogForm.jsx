import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Minus, Image } from 'lucide-react';
import ImageUpload from './ImageUpload';

export default function LogForm({ log, assets, onClose }) {
  const { user } = useAuth();
  const [formData, setFormData] = useState({
    asset_id: log?.asset_id || '',
    log_type: log?.log_type || 'maintenance',
    description: log?.description || '',
    materials_used: log?.materials_used || [],
    image_urls: log?.image_urls || [],
  });
  const [newMaterial, setNewMaterial] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const data = {
        ...formData,
        materials_used: formData.materials_used.length > 0 ? formData.materials_used : null,
      };

      if (log) {
        const { error } = await supabase
          .from('maintenance_logs')
          .update(data)
          .eq('id', log.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('maintenance_logs')
          .insert([{ ...data, user_id: user.id }]);
        if (error) throw error;
      }

      onClose();
    } catch (error) {
      console.error('Error saving log:', error);
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

  const addMaterial = () => {
    if (newMaterial.trim()) {
      setFormData({
        ...formData,
        materials_used: [...formData.materials_used, newMaterial.trim()],
      });
      setNewMaterial('');
    }
  };

  const removeMaterial = (index) => {
    setFormData({
      ...formData,
      materials_used: formData.materials_used.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">
            {log ? 'Edit Log' : 'Add New Log'}
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
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Asset *
            </label>
            <select
              name="asset_id"
              required
              value={formData.asset_id}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="">Select an asset</option>
              {assets.map(asset => (
                <option key={asset.id} value={asset.id}>
                  {asset.name} {asset.serial_number && `(${asset.serial_number})`}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Log Type *
            </label>
            <select
              name="log_type"
              required
              value={formData.log_type}
              onChange={handleChange}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            >
              <option value="maintenance">Maintenance</option>
              <option value="repair">Repair</option>
              <option value="inspection">Inspection</option>
              <option value="comment">Comment</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Description *
            </label>
            <textarea
              name="description"
              required
              rows={4}
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the work performed, issues found, or comments..."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Materials Used
            </label>
            
            {formData.materials_used.length > 0 && (
              <ul className="mb-3 space-y-2">
                {formData.materials_used.map((material, index) => (
                  <li key={index} className="flex items-center justify-between bg-gray-50 p-2 rounded">
                    <span className="text-sm">{material}</span>
                    <button
                      type="button"
                      onClick={() => removeMaterial(index)}
                      className="text-red-600 hover:text-red-900"
                    >
                      <Minus className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            
            <div className="flex space-x-2">
              <input
                type="text"
                value={newMaterial}
                onChange={(e) => setNewMaterial(e.target.value)}
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addMaterial();
                  }
                }}
                placeholder="Add material or part used"
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              />
              <button
                type="button"
                onClick={addMaterial}
                className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Attach Images
            </label>
            {formData.image_urls && formData.image_urls.length > 0 && (
              <div className="mb-3 grid grid-cols-3 gap-2">
                {formData.image_urls.map((url, index) => (
                  <div key={index} className="relative">
                    <img
                      src={url}
                      alt={`Log image ${index + 1}`}
                      className="h-24 w-full object-cover rounded-lg border border-gray-300"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        const newUrls = formData.image_urls.filter((_, i) => i !== index);
                        setFormData({ ...formData, image_urls: newUrls });
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <ImageUpload
              bucket="log-images"
              multiple={true}
              onImageUploaded={(urls) => {
                setFormData({ 
                  ...formData, 
                  image_urls: [...(formData.image_urls || []), ...urls] 
                });
              }}
              onImageRemoved={() => {}}
            />
          </div>

          <div className="flex justify-end space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex justify-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}