import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { X, Plus, Minus } from 'lucide-react';

export default function AdjustQuantityModal({ item, onClose }) {
  const { user } = useAuth();
  const [adjustment, setAdjustment] = useState(0);
  const [type, setType] = useState('add');
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const adjustmentValue = parseInt(adjustment);
      const newQuantity = type === 'add' 
        ? item.quantity + adjustmentValue 
        : item.quantity - adjustmentValue;

      if (newQuantity < 0) {
        throw new Error('Quantity cannot be negative');
      }

      const { error: updateError } = await supabase
        .from('inventory')
        .update({ quantity: newQuantity })
        .eq('id', item.id);

      if (updateError) throw updateError;

      const { error: transactionError } = await supabase
        .from('inventory_transactions')
        .insert([{
          inventory_id: item.id,
          user_id: user.id,
          transaction_type: type,
          quantity: adjustmentValue,
          reason: reason || null,
        }]);

      if (transactionError) throw transactionError;

      onClose();
    } catch (error) {
      console.error('Error adjusting quantity:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const newQuantity = type === 'add' 
    ? item.quantity + parseInt(adjustment || 0)
    : item.quantity - parseInt(adjustment || 0);

  return (
    <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-md w-full">
        <div className="flex justify-between items-center p-6 border-b">
          <h2 className="text-xl font-semibold">Adjust Quantity</h2>
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
            <h3 className="text-lg font-medium text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500">Current quantity: {item.quantity} {item.unit}</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Transaction Type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setType('add')}
                className={`flex items-center justify-center px-3 py-2 border rounded-md ${
                  type === 'add'
                    ? 'border-green-500 bg-green-50 text-green-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Plus className="h-4 w-4 mr-1" />
                Add
              </button>
              <button
                type="button"
                onClick={() => setType('remove')}
                className={`flex items-center justify-center px-3 py-2 border rounded-md ${
                  type === 'remove'
                    ? 'border-red-500 bg-red-50 text-red-700'
                    : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                }`}
              >
                <Minus className="h-4 w-4 mr-1" />
                Remove
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Quantity to {type === 'add' ? 'Add' : 'Remove'}
            </label>
            <input
              type="number"
              min="1"
              required
              value={adjustment}
              onChange={(e) => setAdjustment(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            {adjustment > 0 && (
              <p className="mt-1 text-sm text-gray-500">
                New quantity will be: {newQuantity} {item.unit}
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700">
              Reason (optional)
            </label>
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Used for maintenance, Restocked, etc."
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
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
              disabled={loading || adjustment <= 0 || newQuantity < 0}
              className="inline-flex justify-center rounded-md border border-transparent bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50"
            >
              {loading ? 'Saving...' : 'Confirm'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}