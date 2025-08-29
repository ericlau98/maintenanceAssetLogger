import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  Plus, 
  Clock, 
  AlertCircle, 
  CheckCircle, 
  Pause,
  User,
  Calendar,
  MessageSquare,
  Paperclip,
  ChevronRight,
  Filter,
  Search,
  Mail,
  Hash,
  MoreVertical,
  Edit,
  Trash2,
  Eye
} from 'lucide-react';
import TicketModal from '../components/TicketModal';
import TicketDetailModal from '../components/TicketDetailModal';

const statusColumns = [
  { id: 'todo', title: 'To Do', color: 'bg-gray-100', borderColor: 'border-gray-300', icon: Clock },
  { id: 'in_progress', title: 'In Progress', color: 'bg-blue-50', borderColor: 'border-blue-300', icon: AlertCircle },
  { id: 'review', title: 'Review', color: 'bg-yellow-50', borderColor: 'border-yellow-300', icon: Eye },
  { id: 'completed', title: 'Completed', color: 'bg-green-50', borderColor: 'border-green-300', icon: CheckCircle },
  { id: 'on_hold', title: 'On Hold', color: 'bg-orange-50', borderColor: 'border-orange-300', icon: Pause }
];

const priorityColors = {
  low: 'bg-gray-100 text-gray-700',
  medium: 'bg-blue-100 text-blue-700',
  high: 'bg-orange-100 text-orange-700',
  critical: 'bg-red-100 text-red-700'
};

const departmentColors = {
  'Maintenance': 'bg-purple-100 text-purple-700',
  'Electrical': 'bg-yellow-100 text-yellow-700'
};

export default function Tickets() {
  const { user, profile, isGlobalAdmin, isDepartmentAdmin, canManageDepartment } = useAuth();
  const [tickets, setTickets] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showTicketModal, setShowTicketModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [filterDepartment, setFilterDepartment] = useState('all');
  const [filterAssignee, setFilterAssignee] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTickets();
    fetchDepartments();
    fetchUsers();
  }, []);

  const fetchTickets = async () => {
    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      console.warn('Tickets fetch timeout - setting loading to false');
      setLoading(false);
    }, 8000);

    try {
      let query = supabase
        .from('tickets')
        .select(`
          *,
          department:departments(id, name, email),
          assignee:profiles!tickets_assigned_to_fkey(full_name, email),
          _count:ticket_comments(count)
        `)
        .order('created_at', { ascending: false });

      // Filter tickets based on user role
      if (!isGlobalAdmin && isDepartmentAdmin && profile?.department_id) {
        // Department admins only see their department's tickets
        query = query.eq('department_id', profile.department_id);
      } else if (!isGlobalAdmin && !isDepartmentAdmin) {
        // Regular users see tickets they're assigned to or in their department
        if (profile?.department_id) {
          query = query.or(`assigned_to.eq.${user.id},department_id.eq.${profile.department_id}`);
        } else {
          query = query.eq('assigned_to', user.id);
        }
      }
      // Global admins see all tickets (no filter)

      const { data, error } = await query;

      if (error) throw error;
      setTickets(data || []);
      clearTimeout(timeoutId);
    } catch (error) {
      console.error('Error fetching tickets:', error);
      clearTimeout(timeoutId);
    } finally {
      setLoading(false);
      clearTimeout(timeoutId);
    }
  };

  const fetchDepartments = async () => {
    try {
      let query = supabase
        .from('departments')
        .select('*')
        .order('name');

      // Department admins only see their own department
      if (!isGlobalAdmin && isDepartmentAdmin && profile?.department_id) {
        query = query.eq('id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDepartments(data || []);
    } catch (error) {
      console.error('Error fetching departments:', error);
    }
  };

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, department_id')
        .order('full_name');

      // Department admins only see users in their department
      if (!isGlobalAdmin && isDepartmentAdmin && profile?.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  };

  const handleDragEnd = async (result) => {
    if (!result.destination) return;

    const { source, destination, draggableId } = result;
    
    if (source.droppableId === destination.droppableId) return;

    const ticketToUpdate = tickets.find(t => t.id === draggableId);
    if (!ticketToUpdate) return;

    const newStatus = destination.droppableId;

    // Optimistically update UI
    setTickets(prev => prev.map(ticket => 
      ticket.id === draggableId 
        ? { ...ticket, status: newStatus }
        : ticket
    ));

    try {
      const { error } = await supabase
        .from('tickets')
        .update({ 
          status: newStatus,
          completed_at: newStatus === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', draggableId);

      if (error) throw error;
    } catch (error) {
      console.error('Error updating ticket status:', error);
      // Revert on error
      fetchTickets();
    }
  };

  const handleTicketClick = (ticket) => {
    setSelectedTicket(ticket);
    setShowDetailModal(true);
  };

  const handleTicketUpdate = () => {
    fetchTickets();
    setShowDetailModal(false);
  };

  const handleTicketDelete = async (ticketId) => {
    // Find the ticket to check its department
    const ticketToDelete = tickets.find(t => t.id === ticketId);
    if (!ticketToDelete) return;

    // Check if user can delete this ticket
    if (!canManageDepartment(ticketToDelete.department_id)) {
      alert('You do not have permission to delete tickets from this department');
      return;
    }

    if (!confirm('Are you sure you want to delete this ticket?')) return;

    try {
      const { error } = await supabase
        .from('tickets')
        .delete()
        .eq('id', ticketId);

      if (error) throw error;
      
      fetchTickets();
      setShowDetailModal(false);
    } catch (error) {
      console.error('Error deleting ticket:', error);
      alert('Failed to delete ticket. You may not have permission.');
    }
  };

  const filteredTickets = tickets.filter(ticket => {
    const matchesDepartment = filterDepartment === 'all' || ticket.department_id === filterDepartment;
    const matchesAssignee = filterAssignee === 'all' || ticket.assigned_to === filterAssignee;
    const matchesSearch = searchTerm === '' || 
      ticket.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.ticket_number.toString().includes(searchTerm) ||
      ticket.requester_email.toLowerCase().includes(searchTerm.toLowerCase());
    
    return matchesDepartment && matchesAssignee && matchesSearch;
  });

  const getTicketsByStatus = (status) => {
    return filteredTickets.filter(ticket => ticket.status === status);
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Tickets</h1>
            <p className="text-gray-600 mt-1">Manage maintenance and electrical requests</p>
          </div>
          <button
            onClick={() => setShowTicketModal(true)}
            className="inline-flex items-center px-4 py-2 bg-brand-green text-white rounded-lg hover:bg-brand-dark-green transition-colors"
          >
            <Plus className="h-5 w-5 mr-2" />
            New Ticket
          </button>
        </div>

        {/* Filters */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search tickets..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
            />
          </div>

          <select
            value={filterDepartment}
            onChange={(e) => setFilterDepartment(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
          >
            <option value="all">All Departments</option>
            {departments.map(dept => (
              <option key={dept.id} value={dept.id}>{dept.name}</option>
            ))}
          </select>

          <select
            value={filterAssignee}
            onChange={(e) => setFilterAssignee(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-green focus:border-transparent"
          >
            <option value="all">All Assignees</option>
            <option value="">Unassigned</option>
            {users.map(user => (
              <option key={user.id} value={user.id}>{user.full_name || user.email}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kanban Board */}
      <DragDropContext onDragEnd={handleDragEnd}>
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statusColumns.map(column => {
            const StatusIcon = column.icon;
            const columnTickets = getTicketsByStatus(column.id);
            
            return (
              <div key={column.id} className={`${column.color} rounded-lg p-4`}>
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center">
                    <StatusIcon className="h-5 w-5 mr-2 text-gray-600" />
                    <h3 className="font-semibold text-gray-900">{column.title}</h3>
                  </div>
                  <span className="bg-white px-2 py-1 rounded-full text-xs font-medium text-gray-600">
                    {columnTickets.length}
                  </span>
                </div>

                <Droppable droppableId={column.id}>
                  {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      className={`space-y-3 min-h-[200px] ${
                        snapshot.isDraggingOver ? 'bg-white/50 rounded-lg' : ''
                      }`}
                    >
                      {columnTickets.map((ticket, index) => (
                        <Draggable
                          key={ticket.id}
                          draggableId={ticket.id}
                          index={index}
                        >
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              {...provided.dragHandleProps}
                              onClick={() => handleTicketClick(ticket)}
                              className={`bg-white rounded-lg p-4 shadow-sm border ${column.borderColor} hover:shadow-md transition-all cursor-pointer ${
                                snapshot.isDragging ? 'shadow-lg rotate-2' : ''
                              }`}
                            >
                              <div className="space-y-3">
                                {/* Ticket Header */}
                                <div className="flex items-start justify-between">
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-500 flex items-center">
                                      <Hash className="h-3 w-3 mr-1" />
                                      {ticket.ticket_number}
                                    </span>
                                    <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[ticket.priority]}`}>
                                      {ticket.priority}
                                    </span>
                                  </div>
                                  <MoreVertical className="h-4 w-4 text-gray-400" />
                                </div>

                                {/* Title */}
                                <h4 className="font-medium text-gray-900 line-clamp-2">
                                  {ticket.title}
                                </h4>

                                {/* Department Badge */}
                                {ticket.department && (
                                  <span className={`inline-flex items-center text-xs px-2 py-1 rounded-full ${departmentColors[ticket.department.name]}`}>
                                    {ticket.department.name}
                                  </span>
                                )}

                                {/* Requester */}
                                <div className="flex items-center text-xs text-gray-500">
                                  <Mail className="h-3 w-3 mr-1" />
                                  <span className="truncate">{ticket.requester_email}</span>
                                </div>

                                {/* Footer */}
                                <div className="flex items-center justify-between pt-2 border-t">
                                  <div className="flex items-center space-x-3">
                                    {ticket.assignee ? (
                                      <div className="flex items-center text-xs text-gray-600">
                                        <User className="h-3 w-3 mr-1" />
                                        <span className="truncate max-w-[100px]">
                                          {ticket.assignee.full_name || ticket.assignee.email.split('@')[0]}
                                        </span>
                                      </div>
                                    ) : (
                                      <span className="text-xs text-gray-400">Unassigned</span>
                                    )}
                                    
                                    {ticket._count && ticket._count[0]?.count > 0 && (
                                      <div className="flex items-center text-xs text-gray-500">
                                        <MessageSquare className="h-3 w-3 mr-1" />
                                        {ticket._count[0].count}
                                      </div>
                                    )}
                                  </div>

                                  <div className="flex items-center text-xs text-gray-400">
                                    <Calendar className="h-3 w-3 mr-1" />
                                    {new Date(ticket.created_at).toLocaleDateString()}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </div>
            );
          })}
        </div>
      </DragDropContext>

      {/* Modals */}
      {showTicketModal && (
        <TicketModal
          departments={departments}
          users={users}
          onClose={() => setShowTicketModal(false)}
          onSuccess={() => {
            fetchTickets();
            setShowTicketModal(false);
          }}
        />
      )}

      {showDetailModal && selectedTicket && (
        <TicketDetailModal
          ticket={selectedTicket}
          departments={departments}
          users={users}
          currentUser={profile}
          onClose={() => setShowDetailModal(false)}
          onUpdate={handleTicketUpdate}
          onDelete={handleTicketDelete}
        />
      )}
    </div>
  );
}