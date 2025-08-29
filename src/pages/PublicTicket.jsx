import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createClient } from '@supabase/supabase-js';

// Create a separate Supabase client for public access without auth persistence
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || '',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);
import { 
  Ticket, 
  Send, 
  AlertCircle, 
  CheckCircle, 
  Loader,
  Building2,
  User,
  Mail,
  FileText,
  ArrowLeft,
  Shield
} from 'lucide-react';
import { PublicClientApplication } from '@azure/msal-browser';

// Microsoft Authentication Configuration
const msalConfig = {
  auth: {
    clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${import.meta.env.VITE_MICROSOFT_TENANT_ID || 'common'}`,
    redirectUri: window.location.origin + '/submit-ticket',
  },
  cache: {
    cacheLocation: 'sessionStorage',
    storeAuthStateInCookie: false,
  },
};

// Debug: Log the config to check if env vars are loaded
console.log('MSAL Config Debug:', {
  clientId: import.meta.env.VITE_MICROSOFT_CLIENT_ID,
  tenantId: import.meta.env.VITE_MICROSOFT_TENANT_ID,
  redirectUri: window.location.origin + '/submit-ticket'
});

const loginRequest = {
  scopes: ['openid', 'profile', 'email'],
};

// Initialize MSAL instance
const msalInstance = new PublicClientApplication(msalConfig);

export default function PublicTicket() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [microsoftUser, setMicrosoftUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [departments, setDepartments] = useState([]);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    department_id: '',
    priority: 'medium',
    requester_name: '',
    requester_email: '',
    requester_phone: ''
  });

  useEffect(() => {
    console.log('PublicTicket component mounted');
    initializeMsal();
    fetchDepartments();
  }, []);

  const initializeMsal = async () => {
    try {
      await msalInstance.initialize();
      
      // Check if user is already logged in
      const accounts = msalInstance.getAllAccounts();
      if (accounts.length > 0) {
        const account = accounts[0];
        setMicrosoftUser(account);
        setFormData(prev => ({
          ...prev,
          requester_name: account.name || '',
          requester_email: account.username || ''
        }));
      }
      
      // Handle redirect response
      try {
        const response = await msalInstance.handleRedirectPromise();
        if (response && response.account) {
          setMicrosoftUser(response.account);
          setFormData(prev => ({
            ...prev,
            requester_name: response.account.name || '',
            requester_email: response.account.username || ''
          }));
        }
      } catch (err) {
        console.error('Error handling redirect:', err);
      }
    } catch (error) {
      console.error('MSAL initialization error:', error);
      setError('Failed to initialize authentication. Please refresh the page.');
    } finally {
      setLoading(false);
    }
  };

  const handleMicrosoftLogin = async () => {
    try {
      setError('');
      
      // Debug: Check if client ID is present
      if (!import.meta.env.VITE_MICROSOFT_CLIENT_ID) {
        console.error('Missing VITE_MICROSOFT_CLIENT_ID');
        setError('Microsoft authentication is not configured. Please contact support.');
        return;
      }
      
      console.log('Attempting login with config:', {
        clientId: msalConfig.auth.clientId,
        authority: msalConfig.auth.authority,
        redirectUri: msalConfig.auth.redirectUri
      });
      
      await msalInstance.loginRedirect(loginRequest);
    } catch (error) {
      console.error('Login error details:', {
        error: error,
        message: error.message,
        errorCode: error.errorCode,
        errorMessage: error.errorMessage
      });
      setError(`Failed to sign in: ${error.errorMessage || error.message || 'Unknown error'}`);
    }
  };

  const handleMicrosoftLogout = async () => {
    try {
      await msalInstance.logoutRedirect({
        postLogoutRedirectUri: window.location.origin + '/submit-ticket',
      });
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const fetchDepartments = async () => {
    try {
      console.log('Starting department fetch...');
      console.log('Supabase URL:', import.meta.env.VITE_SUPABASE_URL);
      console.log('Using anon key:', import.meta.env.VITE_SUPABASE_ANON_KEY?.substring(0, 20) + '...');
      
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      
      if (error) {
        console.error('Supabase error fetching departments:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
        throw error;
      }
      
      console.log('Departments fetched successfully:', data);
      console.log('Number of departments:', data?.length || 0);
      setDepartments(data || []);
      
      // Debug: Check if departments state is set
      if (!data || data.length === 0) {
        console.warn('No departments returned from database');
      }
    } catch (error) {
      console.error('Error in fetchDepartments:', error);
      // Show user-friendly error but don't set error state if user is not logged in yet
      if (microsoftUser) {
        setError('Unable to load departments. Please refresh the page.');
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!microsoftUser) {
      setError('Please sign in with your Microsoft account to submit a ticket.');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      // Create ticket using Supabase
      const { data: ticket, error: ticketError } = await supabase
        .from('tickets')
        .insert({
          title: formData.title,
          description: formData.description,
          department_id: formData.department_id,
          priority: formData.priority,
          requester_name: formData.requester_name,
          requester_email: formData.requester_email,
          requester_phone: formData.requester_phone || null,
          status: 'to_do',
          created_via: 'public_form'
        })
        .select()
        .single();

      if (ticketError) throw ticketError;

      // Queue confirmation email
      const { data: emailData, error: emailError } = await supabase
        .from('email_queue')
        .insert({
          ticket_id: ticket.id,
          to_email: formData.requester_email,
          subject: `Ticket #${ticket.ticket_number} Created - ${formData.title}`,
          body: `Hello ${formData.requester_name},

Your support ticket has been successfully created and assigned to the ${departments.find(d => d.id === formData.department_id)?.name} department.

Ticket Number: #${ticket.ticket_number}
Title: ${formData.title}
Priority: ${formData.priority}
Status: To Do

We will review your request and update you on its progress. You can expect a response within 24-48 hours.

Thank you for submitting your request.

Best regards,
Great Lakes Greenhouses Support Team`,
          template_type: 'ticket_created',
          status: 'pending'
        })
        .select()
        .single();

      if (emailError) {
        console.error('Error queuing email:', emailError);
        // Don't fail the ticket creation if email fails
      } else {
        console.log('Email queued successfully:', emailData);
      }

      setSuccess(true);
      setFormData({
        title: '',
        description: '',
        department_id: '',
        priority: 'medium',
        requester_name: microsoftUser.name || '',
        requester_email: microsoftUser.username || '',
        requester_phone: ''
      });

      // Show success message for 5 seconds then reset
      setTimeout(() => {
        setSuccess(false);
      }, 5000);

    } catch (error) {
      console.error('Error creating ticket:', error);
      setError('Failed to create ticket. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-white to-brand-light/20 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-green"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-white to-brand-light/20">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-brand-light">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <img src="/logo.jpg" alt="Great Lakes Greenhouses" className="h-10 sm:h-12 w-auto" />
              <div className="ml-4">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Submit Support Ticket</h1>
                <p className="text-sm text-gray-600">Great Lakes Greenhouses Support</p>
              </div>
            </div>
            {microsoftUser && (
              <button
                onClick={handleMicrosoftLogout}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Microsoft Authentication */}
        {!microsoftUser ? (
          <div className="bg-white rounded-xl shadow-lg p-8 text-center">
            <Shield className="h-16 w-16 text-brand-green mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Authentication Required</h2>
            <p className="text-gray-600 mb-6">
              Please sign in with your Microsoft account to submit a support ticket.
            </p>
            <button
              onClick={handleMicrosoftLogin}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-brand-green hover:bg-brand-dark-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
            >
              <svg className="h-5 w-5 mr-2" viewBox="0 0 21 21">
                <rect x="1" y="1" width="9" height="9" fill="#f25022"/>
                <rect x="1" y="11" width="9" height="9" fill="#00a4ef"/>
                <rect x="11" y="1" width="9" height="9" fill="#7fba00"/>
                <rect x="11" y="11" width="9" height="9" fill="#ffb900"/>
              </svg>
              Sign in with Microsoft
            </button>
            {error && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* User Info */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <User className="h-5 w-5 text-blue-600 mr-2" />
                <div className="flex-1">
                  <p className="text-sm text-blue-900">
                    Signed in as: <strong>{microsoftUser.name || microsoftUser.username}</strong>
                  </p>
                </div>
                <button
                  onClick={handleMicrosoftLogout}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  Switch Account
                </button>
              </div>
            </div>

            {/* Success Message */}
            {success && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <div>
                    <p className="text-sm font-medium text-green-900">Ticket submitted successfully!</p>
                    <p className="text-sm text-green-700 mt-1">
                      You will receive a confirmation email shortly.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Ticket Form */}
            <div className="bg-white rounded-xl shadow-lg p-6 sm:p-8">
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Department Selection */}
                <div>
                  <label htmlFor="department" className="block text-sm font-medium text-gray-700">
                    Department * {departments.length === 0 && <span className="text-red-500">(Loading...)</span>}
                  </label>
                  <select
                    id="department"
                    required
                    value={formData.department_id}
                    onChange={(e) => {
                      console.log('Department selected:', e.target.value);
                      setFormData({...formData, department_id: e.target.value});
                    }}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                  >
                    <option value="">Select a department</option>
                    {console.log('Rendering departments in dropdown:', departments)}
                    {departments.length > 0 ? (
                      departments.map(dept => (
                        <option key={dept.id} value={dept.id}>{dept.name}</option>
                      ))
                    ) : (
                      <option disabled>No departments available</option>
                    )}
                  </select>
                </div>

                {/* Title */}
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Issue Title *
                  </label>
                  <input
                    type="text"
                    id="title"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({...formData, title: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    placeholder="Brief description of your issue"
                  />
                </div>

                {/* Description */}
                <div>
                  <label htmlFor="description" className="block text-sm font-medium text-gray-700">
                    Description *
                  </label>
                  <textarea
                    id="description"
                    required
                    rows={6}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                    placeholder="Please provide detailed information about your issue..."
                  />
                </div>

                {/* Priority */}
                <div>
                  <label htmlFor="priority" className="block text-sm font-medium text-gray-700">
                    Priority
                  </label>
                  <select
                    id="priority"
                    value={formData.priority}
                    onChange={(e) => setFormData({...formData, priority: e.target.value})}
                    className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                  >
                    <option value="low">Low - Can wait a few days</option>
                    <option value="medium">Medium - Should be addressed soon</option>
                    <option value="high">High - Urgent issue affecting operations</option>
                  </select>
                </div>

                {/* Contact Information */}
                <div className="space-y-4 pt-4 border-t border-gray-200">
                  <h3 className="text-sm font-medium text-gray-700">Contact Information</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        id="name"
                        required
                        value={formData.requester_name}
                        onChange={(e) => setFormData({...formData, requester_name: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                      />
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                        Email *
                      </label>
                      <input
                        type="email"
                        id="email"
                        required
                        value={formData.requester_email}
                        onChange={(e) => setFormData({...formData, requester_email: e.target.value})}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                      />
                    </div>
                  </div>

                  <div>
                    <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
                      Phone Number (Optional)
                    </label>
                    <input
                      type="tel"
                      id="phone"
                      value={formData.requester_phone}
                      onChange={(e) => setFormData({...formData, requester_phone: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-brand-green focus:ring-brand-green"
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                </div>

                {/* Error Message */}
                {error && (
                  <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                    <div className="flex items-center">
                      <AlertCircle className="h-5 w-5 text-red-600 mr-2" />
                      <p className="text-sm text-red-600">{error}</p>
                    </div>
                  </div>
                )}

                {/* Submit Button */}
                <div className="flex justify-between pt-4">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green"
                  >
                    <ArrowLeft className="h-4 w-4 mr-2" />
                    Back to App
                  </button>
                  
                  <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center px-6 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-brand-green hover:bg-brand-dark-green focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand-green disabled:opacity-50"
                  >
                    {submitting ? (
                      <>
                        <Loader className="h-4 w-4 mr-2 animate-spin" />
                        Submitting...
                      </>
                    ) : (
                      <>
                        <Send className="h-4 w-4 mr-2" />
                        Submit Ticket
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>

          </>
        )}
      </div>
    </div>
  );
}