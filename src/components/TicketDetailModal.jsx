import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { 
  X, 
  User, 
  Mail, 
  Calendar, 
  MessageSquare, 
  Send, 
  Edit2, 
  Trash2,
  AlertCircle,
  Building2,
  Hash,
  Clock,
  CheckCircle,
  Pause,
  Eye,
  Paperclip,
  Info,
  Lock
} from 'lucide-react';

const statusOptions = [
  { value: 'todo', label: 'To Do', icon: Clock, color: 'text-gray-600' },
  { value: 'in_progress', label: 'In Progress', icon: AlertCircle, color: 'text-blue-600' },
  { value: 'review', label: 'Review', icon: Eye, color: 'text-yellow-600' },
  { value: 'completed', label: 'Completed', icon: CheckCircle, color: 'text-green-600' },
  { value: 'on_hold', label: 'On Hold', icon: Pause, color: 'text-orange-600' }
];

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
};

export default function TicketDetailModal({ ticket, departments, users, currentUser, onClose, onUpdate, onDelete }) {
  const [loading, setLoading] = useState(false);
  const [comments, setComments] = useState([]);
  const [history, setHistory] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [isInternal, setIsInternal] = useState(false);
  const [requestingInfo, setRequestingInfo] = useState(false);
  const [infoRequest, setInfoRequest] = useState('');
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({
    title: ticket.title,
    description: ticket.description,
    priority: ticket.priority,
    assigned_to: ticket.assigned_to || '',
    status: ticket.status
  });

  useEffect(() => {
    fetchComments();
    fetchHistory();
  }, [ticket.id]);

  const fetchComments = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_comments')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setComments(data || []);
    } catch (error) {
      console.error('Error fetching comments:', error);
    }
  };

  const fetchHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('ticket_history')
        .select(`
          *,
          user:profiles(full_name, email)
        `)
        .eq('ticket_id', ticket.id)
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      setHistory(data || []);
    } catch (error) {
      console.error('Error fetching history:', error);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticket.id,
          user_id: currentUser.id,
          comment: newComment,
          is_internal: isInternal
        });

      if (error) throw error;

      // Queue email if not internal
      if (!isInternal) {
        await supabase
          .from('email_queue')
          .insert({
            ticket_id: ticket.id,
            to_email: ticket.requester_email,
            subject: `New Comment on Ticket #${ticket.ticket_number}`,
            body: newComment,
            template_type: 'comment_added'
          });
      }

      setNewComment('');
      setIsInternal(false);
      fetchComments();
      onUpdate();
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Failed to add comment');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestInfo = async () => {
    if (!infoRequest.trim()) return;

    setLoading(true);
    try {
      // Add comment with info request
      await supabase
        .from('ticket_comments')
        .insert({
          ticket_id: ticket.id,
          user_id: currentUser.id,
          comment: `🔍 Information Requested: ${infoRequest}`,
          is_internal: false
        });

      // Queue email for info request
      await supabase
        .from('email_queue')
        .insert({
          ticket_id: ticket.id,
          to_email: ticket.requester_email,
          subject: `Information Needed for Ticket #${ticket.ticket_number}`,
          body: `We need additional information to proceed with your ticket:\n\n${infoRequest}\n\nPlease reply to this email with the requested information.`,
          template_type: 'info_requested'
        });

      setInfoRequest('');
      setRequestingInfo(false);
      fetchComments();
      alert('Information request sent to requester');
    } catch (error) {
      console.error('Error requesting info:', error);
      alert('Failed to send info request');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateTicket = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('tickets')
        .update({
          title: editData.title,
          description: editData.description,
          priority: editData.priority,
          assigned_to: editData.assigned_to || null,
          status: editData.status,
          completed_at: editData.status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', ticket.id);

      if (error) throw error;

      setEditing(false);
      onUpdate();
    } catch (error) {
      console.error('Error updating ticket:', error);
      alert('Failed to update ticket');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteComment = async (commentId) => {
    if (!confirm('Are you sure you want to delete this comment?')) return;

    try {
      const { error } = await supabase
        .from('ticket_comments')
        .delete()
        .eq('id', commentId);

      if (error) throw error;
      fetchComments();
    } catch (error) {
      console.error('Error deleting comment:', error);
      alert('Failed to delete comment');
    }
  };

  const formatHistoryAction = (action) => {
    const actionMap = {
      'created': 'created the ticket',
      'status_changed': 'changed status',
      'assignee_changed': 'changed assignee',
      'priority_changed': 'changed priority',
      'comment_added': 'added a comment',
      'internal_comment_added': 'added an internal note'
    };
    return actionMap[action] || action;
  };

  const StatusIcon = statusOptions.find(s => s.value === (editing ? editData.status : ticket.status))?.icon || Clock;
  const statusColor = statusOptions.find(s => s.value === (editing ? editData.status : ticket.status))?.color || 'text-gray-600';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-gray-50">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Hash className="h-5 w-5 text-gray-500" />
              <span className="text-lg font-semibold text-gray-900">
                Ticket #{ticket.ticket_number}
              </span>
            </div>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${priorityColors[editing ? editData.priority : ticket.priority]}`}>
              {editing ? editData.priority : ticket.priority}
            </span>
            <div className={`flex items-center space-x-1 ${statusColor}`}>
              <StatusIcon className="h-4 w-4" />
              <span className="text-sm font-medium">
                {statusOptions.find(s => s.value === (editing ? editData.status : ticket.status))?.label}
              </span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {!editing && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                  title="Edit Ticket"
                >
                  <Edit2 className="h-4 w-4 text-gray-600" />
                </button>
                <button
                  onClick={() => onDelete(ticket.id)}
                  className="p-2 hover:bg-red-100 rounded-lg transition-colors"
                  title="Delete Ticket"
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <X className="h-5 w-5 text-gray-500" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Ticket Details */}
          <div className="p-6 border-b">
            {editing ? (
              <div className="space-y-4">
                <input
                  type="text"
                  value={editData.title}
                  onChange={(e) => setEditData(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full text-xl font-semibold px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                />
                <textarea
                  value={editData.description}
                  onChange={(e) => setEditData(prev => ({ ...prev, description: e.target.value }))}
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green resize-none"
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                    <select
                      value={editData.status}
                      onChange={(e) => setEditData(prev => ({ ...prev, status: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                    >
                      {statusOptions.map(status => (
                        <option key={status.value} value={status.value}>{status.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
                    <select
                      value={editData.priority}
                      onChange={(e) => setEditData(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assigned To</label>
                    <select
                      value={editData.assigned_to}
                      onChange={(e) => setEditData(prev => ({ ...prev, assigned_to: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green"
                    >
                      <option value="">Unassigned</option>
                      {users.map(user => (
                        <option key={user.id} value={user.id}>
                          {user.full_name || user.email}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => setEditing(false)}
                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleUpdateTicket}
                    disabled={loading}
                    className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-dark-green transition-colors disabled:opacity-50"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            ) : (
              <>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{ticket.title}</h2>
                <p className="text-gray-600 mb-4">{ticket.description}</p>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-500">Department:</span>
                    <span className="ml-2 font-medium">{ticket.department?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Requester:</span>
                    <span className="ml-2 font-medium">{ticket.requester_name}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Email:</span>
                    <span className="ml-2 font-medium">{ticket.requester_email}</span>
                  </div>
                  <div>
                    <span className="text-gray-500">Assigned To:</span>
                    <span className="ml-2 font-medium">
                      {ticket.assignee ? (ticket.assignee.full_name || ticket.assignee.email) : 'Unassigned'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Created:</span>
                    <span className="ml-2 font-medium">
                      {new Date(ticket.created_at).toLocaleString()}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-500">Last Updated:</span>
                    <span className="ml-2 font-medium">
                      {new Date(ticket.updated_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* Comments Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center">
                <MessageSquare className="h-5 w-5 mr-2" />
                Comments ({comments.length})
              </h3>
              {!requestingInfo && (
                <button
                  onClick={() => setRequestingInfo(true)}
                  className="text-sm text-brand-green hover:text-brand-dark-green flex items-center"
                >
                  <Info className="h-4 w-4 mr-1" />
                  Request Info
                </button>
              )}
            </div>

            {/* Request Info Form */}
            {requestingInfo && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <h4 className="text-sm font-medium text-gray-900 mb-2">Request Information from Requester</h4>
                <textarea
                  value={infoRequest}
                  onChange={(e) => setInfoRequest(e.target.value)}
                  placeholder="What information do you need?"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green resize-none mb-2"
                  rows={3}
                />
                <div className="flex justify-end space-x-2">
                  <button
                    onClick={() => {
                      setRequestingInfo(false);
                      setInfoRequest('');
                    }}
                    className="px-3 py-1 text-sm text-gray-600 hover:text-gray-800"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRequestInfo}
                    disabled={loading || !infoRequest.trim()}
                    className="px-3 py-1 text-sm bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 disabled:opacity-50"
                  >
                    Send Request
                  </button>
                </div>
              </div>
            )}

            {/* Comments List */}
            <div className="space-y-3 mb-4 max-h-64 overflow-y-auto">
              {comments.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No comments yet</p>
              ) : (
                comments.map(comment => (
                  <div key={comment.id} className={`p-3 rounded-lg ${comment.is_internal ? 'bg-yellow-50 border border-yellow-200' : 'bg-gray-50'}`}>
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center space-x-2 mb-1">
                          <span className="font-medium text-sm text-gray-900">
                            {comment.user?.full_name || comment.user?.email || 'Unknown'}
                          </span>
                          <span className="text-xs text-gray-500">
                            {new Date(comment.created_at).toLocaleString()}
                          </span>
                          {comment.is_internal && (
                            <span className="flex items-center text-xs text-yellow-700">
                              <Lock className="h-3 w-3 mr-1" />
                              Internal Note
                            </span>
                          )}
                        </div>
                        <p className="text-gray-700 text-sm whitespace-pre-wrap">{comment.comment}</p>
                      </div>
                      {comment.user_id === currentUser?.id && (
                        <button
                          onClick={() => handleDeleteComment(comment.id)}
                          className="ml-2 p-1 hover:bg-gray-200 rounded transition-colors"
                        >
                          <Trash2 className="h-3 w-3 text-gray-500" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Add Comment Form */}
            <div className="border-t pt-4">
              <div className="flex items-start space-x-2">
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Add a comment..."
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green resize-none"
                  rows={2}
                />
                <div className="flex flex-col space-y-2">
                  <label className="flex items-center space-x-2 text-sm">
                    <input
                      type="checkbox"
                      checked={isInternal}
                      onChange={(e) => setIsInternal(e.target.checked)}
                      className="rounded text-brand-green focus:ring-brand-green"
                    />
                    <span>Internal</span>
                  </label>
                  <button
                    onClick={handleAddComment}
                    disabled={loading || !newComment.trim()}
                    className="px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-dark-green transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Activity History */}
          {history.length > 0 && (
            <div className="p-6 border-t bg-gray-50">
              <h3 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
                <Clock className="h-5 w-5 mr-2" />
                Recent Activity
              </h3>
              <div className="space-y-2">
                {history.map(item => (
                  <div key={item.id} className="text-sm">
                    <span className="font-medium text-gray-700">
                      {item.user?.full_name || item.user?.email || 'System'}
                    </span>
                    <span className="text-gray-500 mx-2">{formatHistoryAction(item.action)}</span>
                    {item.field_changed && (
                      <span className="text-gray-600">
                        from <span className="font-medium">{item.old_value || 'none'}</span> to{' '}
                        <span className="font-medium">{item.new_value}</span>
                      </span>
                    )}
                    <span className="text-gray-400 ml-2">
                      {new Date(item.created_at).toLocaleString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}