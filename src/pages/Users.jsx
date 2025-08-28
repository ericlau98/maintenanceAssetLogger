import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { 
  User, 
  Shield, 
  Building2, 
  Trash2, 
  Search,
  Globe,
  Wrench,
  Zap,
  UserPlus,
  Edit,
  Key,
  X,
  Save,
  Mail
} from 'lucide-react';

export default function Users() {
  const { profile, isGlobalAdmin, isDepartmentAdmin, canManageDepartment } = useAuth();
  const [users, setUsers] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddUser, setShowAddUser] = useState(false);
  const [editingUser, setEditingUser] = useState(null);
  const [newUser, setNewUser] = useState({
    email: '',
    full_name: '',
    role: 'user',
    department_id: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchDepartments();
  }, []);

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('profiles')
        .select('*, department:departments!profiles_department_id_fkey(*)')
        .order('created_at', { ascending: false });

      // Department admins only see users in their department
      if (!isGlobalAdmin && isDepartmentAdmin && profile?.department_id) {
        query = query.eq('department_id', profile.department_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
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

  const handleAddUser = async () => {
    if (!newUser.email || !newUser.full_name) {
      alert('Please fill in all required fields');
      return;
    }

    // Department admins can only add users to their department
    const departmentId = !isGlobalAdmin && isDepartmentAdmin 
      ? profile?.department_id 
      : newUser.department_id;

    try {
      // Generate a random temporary password
      const tempPassword = Math.random().toString(36).slice(-8) + 
                          Math.random().toString(36).slice(-8).toUpperCase() + 
                          '!@#$%^&*'.charAt(Math.floor(Math.random() * 8)) + 
                          Math.floor(Math.random() * 100);

      // Create auth user with temporary password
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: tempPassword,
        options: {
          data: {
            full_name: newUser.full_name,
          },
          emailRedirectTo: window.location.origin
        }
      });

      if (authError) throw authError;

      // Create profile
      const { error: profileError } = await supabase
        .from('profiles')
        .insert({
          id: authData.user.id,
          email: newUser.email,
          full_name: newUser.full_name,
          role: newUser.role,
          department_id: departmentId || null
        });

      if (profileError) {
        // If profile creation fails, we should ideally delete the auth user
        console.error('Profile creation failed:', profileError);
        throw profileError;
      }

      // Generate password reset link and send welcome email
      const { data: resetData, error: resetError } = await supabase.auth.resetPasswordForEmail(
        newUser.email,
        {
          redirectTo: `${window.location.origin}/login`,
        }
      );

      if (resetError) {
        console.error('Error sending password reset email:', resetError);
        // Don't throw here - user is created, just email failed
        alert(`User created but email failed to send. Please manually send a password reset to ${newUser.email}`);
      } else {
        // Send a custom welcome email via our edge function
        try {
          const { error: emailError } = await supabase.functions.invoke('send-auth-email', {
            body: {
              type: 'admin_created',
              email: newUser.email,
              data: {
                full_name: newUser.full_name,
                admin_name: profile?.full_name || 'Administrator',
                confirmation_url: `${window.location.origin}/login#recovery-token` // This will be replaced by the actual reset link
              }
            }
          });

          if (emailError) {
            console.error('Error sending welcome email:', emailError);
          }
        } catch (emailError) {
          console.error('Error invoking email function:', emailError);
        }

        alert(`User created successfully! A welcome email with password setup instructions has been sent to ${newUser.email}`);
      }

      setShowAddUser(false);
      setNewUser({
        email: '',
        password: '',
        full_name: '',
        role: 'user',
        department_id: ''
      });
      fetchUsers();
    } catch (error) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleEditUser = async () => {
    if (!editingUser) return;

    try {
      const updateData = {
        full_name: editingUser.full_name,
        role: editingUser.role,
        department_id: editingUser.department_id || null
      };

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', editingUser.id);

      if (error) throw error;
      
      alert('User updated successfully');
      setEditingUser(null);
      fetchUsers();
    } catch (error) {
      console.error('Error updating user:', error);
      alert('Failed to update user');
    }
  };

  const handlePasswordReset = async (email) => {
    if (!window.confirm(`Send password reset email to ${email}?`)) {
      return;
    }

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;
      
      alert(`Password reset email sent to ${email}`);
    } catch (error) {
      console.error('Error sending password reset:', error);
      alert('Failed to send password reset email');
    }
  };

  const handleDelete = async (userId) => {
    const userToDelete = users.find(u => u.id === userId);
    
    // Check permissions
    if (!isGlobalAdmin && isDepartmentAdmin) {
      if (!canManageDepartment(userToDelete?.department_id)) {
        alert('You can only delete users in your department');
        return;
      }
      if (userToDelete?.role !== 'user') {
        alert('You cannot delete admin users');
        return;
      }
    }

    if (!window.confirm(`Are you sure you want to delete ${userToDelete?.full_name || userToDelete?.email}? This action cannot be undone.`)) {
      return;
    }

    try {
      // Delete from profiles table
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', userId);
      
      if (error) throw error;
      
      // Note: To fully delete from auth.users, you need service role key
      // This would be done via an edge function in production
      
      setUsers(users.filter(user => user.id !== userId));
      alert('User deleted successfully');
    } catch (error) {
      console.error('Error deleting user:', error);
      alert('Failed to delete user');
    }
  };

  const getRoleIcon = (role) => {
    switch(role) {
      case 'global_admin':
        return <Globe className="h-5 w-5 text-purple-600" />;
      case 'maintenance_admin':
        return <Wrench className="h-5 w-5 text-blue-600" />;
      case 'electrical_admin':
        return <Zap className="h-5 w-5 text-yellow-600" />;
      default:
        return <User className="h-5 w-5 text-gray-600" />;
    }
  };

  const getRoleLabel = (role) => {
    switch(role) {
      case 'global_admin':
        return 'Global Admin';
      case 'maintenance_admin':
        return 'Maintenance Admin';
      case 'electrical_admin':
        return 'Electrical Admin';
      default:
        return 'User';
    }
  };

  const getRoleBadgeColor = (role) => {
    switch(role) {
      case 'global_admin':
        return 'bg-purple-100 text-purple-800';
      case 'maintenance_admin':
        return 'bg-blue-100 text-blue-800';
      case 'electrical_admin':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const filteredUsers = users.filter(user =>
    user.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.department?.name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-xl shadow-md p-6">
        <div className="sm:flex sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
            <p className="mt-2 text-sm text-gray-700">
              {isGlobalAdmin 
                ? 'Manage all users and their permissions across departments.'
                : `Manage users in the ${profile?.department?.name || 'your'} department.`}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center gap-3">
            <button
              onClick={() => setShowAddUser(true)}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-green hover:bg-brand-dark-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
            >
              <UserPlus className="h-4 w-4 mr-2" />
              Add User
            </button>
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getRoleBadgeColor(profile?.role)}`}>
              {getRoleIcon(profile?.role)}
              <span className="ml-2">{getRoleLabel(profile?.role)}</span>
            </span>
          </div>
        </div>

        {/* Search */}
        <div className="mt-6">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-green focus:border-transparent"
              placeholder="Search users by name, email, or department..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Department
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const canEdit = user.id !== profile?.id && 
                  (isGlobalAdmin || (isDepartmentAdmin && canManageDepartment(user.department_id)));
                
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0">
                          <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center">
                            {getRoleIcon(user.role)}
                          </div>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">
                            {user.full_name || 'No name'}
                          </div>
                          <div className="text-sm text-gray-500">
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        <Building2 className="h-3 w-3 mr-1" />
                        {user.department?.name || 'No Department'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleBadgeColor(user.role)}`}>
                        {getRoleLabel(user.role)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-2">
                        {canEdit && (
                          <>
                            <button
                              onClick={() => setEditingUser({...user})}
                              className="text-indigo-600 hover:text-indigo-900 transition-colors"
                              title="Edit user"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handlePasswordReset(user.email)}
                              className="text-amber-600 hover:text-amber-900 transition-colors"
                              title="Reset password"
                            >
                              <Key className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => handleDelete(user.id)}
                              className="text-red-600 hover:text-red-900 transition-colors"
                              title="Delete user"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              No users found matching your search.
            </div>
          )}
        </div>
      </div>

      {/* Add User Modal */}
      {showAddUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Add New User</h2>
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setNewUser({
                    email: '',
                    full_name: '',
                    role: 'user',
                    department_id: ''
                  });
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name *</label>
                <input
                  type="text"
                  value={newUser.full_name}
                  onChange={(e) => setNewUser({...newUser, full_name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                  placeholder="John Doe"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email *</label>
                <input
                  type="email"
                  value={newUser.email}
                  onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                  placeholder="john@example.com"
                />
              </div>

              <div className="bg-blue-50 p-3 rounded-lg">
                <div className="flex items-start">
                  <Mail className="h-5 w-5 text-blue-500 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-blue-700">
                    A welcome email will be sent to the user with instructions to set up their password.
                  </p>
                </div>
              </div>

              {isGlobalAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <select
                      value={newUser.department_id}
                      onChange={(e) => setNewUser({...newUser, department_id: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    >
                      <option value="">No Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={newUser.role}
                      onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    >
                      <option value="user">User</option>
                      <option value="global_admin">Global Admin</option>
                      <option value="maintenance_admin">Maintenance Admin</option>
                      <option value="electrical_admin">Electrical Admin</option>
                    </select>
                  </div>
                </>
              )}

              {isDepartmentAdmin && !isGlobalAdmin && (
                <div className="bg-blue-50 p-3 rounded-lg">
                  <p className="text-sm text-blue-700">
                    User will be added to the {profile?.department?.name} department with User role.
                  </p>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowAddUser(false);
                  setNewUser({
                    email: '',
                    full_name: '',
                    role: 'user',
                    department_id: ''
                  });
                }}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
              >
                Cancel
              </button>
              <button
                onClick={handleAddUser}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-green border border-transparent rounded-md hover:bg-brand-dark-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
              >
                Add User
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold text-gray-900">Edit User</h2>
              <button
                onClick={() => setEditingUser(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Full Name</label>
                <input
                  type="text"
                  value={editingUser.full_name || ''}
                  onChange={(e) => setEditingUser({...editingUser, full_name: e.target.value})}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700">Email</label>
                <input
                  type="email"
                  value={editingUser.email}
                  disabled
                  className="mt-1 block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm"
                />
              </div>

              {isGlobalAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700">Department</label>
                    <select
                      value={editingUser.department_id || ''}
                      onChange={(e) => setEditingUser({...editingUser, department_id: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    >
                      <option value="">No Department</option>
                      {departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700">Role</label>
                    <select
                      value={editingUser.role}
                      onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    >
                      <option value="user">User</option>
                      <option value="global_admin">Global Admin</option>
                      <option value="maintenance_admin">Maintenance Admin</option>
                      <option value="electrical_admin">Electrical Admin</option>
                    </select>
                  </div>
                </>
              )}

              {isDepartmentAdmin && !isGlobalAdmin && editingUser.role === 'user' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Role</label>
                  <select
                    value={editingUser.role}
                    onChange={(e) => setEditingUser({...editingUser, role: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                  >
                    <option value="user">User</option>
                  </select>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setEditingUser(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
              >
                Cancel
              </button>
              <button
                onClick={handleEditUser}
                className="px-4 py-2 text-sm font-medium text-white bg-brand-green border border-transparent rounded-md hover:bg-brand-dark-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
              >
                Save Changes
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
        <div className="flex">
          <div className="flex-shrink-0">
            <Shield className="h-5 w-5 text-blue-400" />
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              <strong>Permission Levels:</strong>
            </p>
            <ul className="mt-2 text-sm text-blue-600 space-y-1">
              <li>• <strong>Global Admin:</strong> Full system access, manage all departments and users</li>
              <li>• <strong>Maintenance Admin:</strong> Manage maintenance department tickets and users</li>
              <li>• <strong>Electrical Admin:</strong> Manage electrical department tickets and users</li>
              <li>• <strong>User:</strong> Create and view tickets, limited to assigned or department tickets</li>
            </ul>
            {(isGlobalAdmin || isDepartmentAdmin) && (
              <div className="mt-3 pt-3 border-t border-blue-300">
                <p className="text-sm text-blue-700">
                  <strong>User Management Actions:</strong>
                </p>
                <ul className="mt-2 text-sm text-blue-600 space-y-1">
                  <li>• <strong>Add User:</strong> Create new user accounts with email/password</li>
                  <li>• <strong>Edit:</strong> Modify user details, department, and role</li>
                  <li>• <strong>Reset Password:</strong> Send password reset email to user</li>
                  <li>• <strong>Delete:</strong> Remove user from system (cannot be undone)</li>
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}