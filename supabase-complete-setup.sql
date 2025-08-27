-- =====================================================
-- COMPLETE DATABASE SETUP SCRIPT
-- This creates all tables, functions, triggers, and policies
-- =====================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron" SCHEMA extensions;

-- =====================================================
-- CORE TABLES
-- =====================================================

-- Create departments table first (referenced by profiles)
CREATE TABLE departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  email TEXT NOT NULL UNIQUE,
  description TEXT,
  admin_user_id UUID,
  admin_email TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create profiles table
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT,
  role TEXT CHECK (role IN ('global_admin', 'maintenance_admin', 'electrical_admin', 'user')) DEFAULT 'user',
  department_id UUID REFERENCES departments(id),
  is_department_admin BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Add foreign key for department admin
ALTER TABLE departments 
ADD CONSTRAINT departments_admin_user_id_fkey 
FOREIGN KEY (admin_user_id) REFERENCES profiles(id);

-- Create assets table
CREATE TABLE assets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  serial_number TEXT UNIQUE,
  category TEXT,
  location TEXT,
  status TEXT CHECK (status IN ('active', 'maintenance', 'retired')) DEFAULT 'active',
  purchase_date DATE,
  purchase_price DECIMAL(10, 2),
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create inventory table
CREATE TABLE inventory (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  sku TEXT UNIQUE,
  category TEXT,
  quantity INTEGER DEFAULT 0 CHECK (quantity >= 0),
  min_quantity INTEGER DEFAULT 0,
  unit TEXT,
  location TEXT,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create maintenance logs table
CREATE TABLE maintenance_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  asset_id UUID REFERENCES assets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  log_type TEXT CHECK (log_type IN ('maintenance', 'repair', 'inspection', 'comment')),
  description TEXT NOT NULL,
  materials_used JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create inventory transactions table
CREATE TABLE inventory_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  inventory_id UUID REFERENCES inventory(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  transaction_type TEXT CHECK (transaction_type IN ('add', 'remove', 'adjust')),
  quantity INTEGER NOT NULL,
  reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- TICKETING TABLES
-- =====================================================

-- Create tickets table
CREATE TABLE tickets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_number SERIAL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  department_id UUID REFERENCES departments(id) ON DELETE RESTRICT,
  requester_email TEXT NOT NULL,
  requester_name TEXT NOT NULL,
  assigned_to UUID REFERENCES profiles(id),
  status TEXT CHECK (status IN ('todo', 'in_progress', 'review', 'completed', 'on_hold')) DEFAULT 'todo',
  priority TEXT CHECK (priority IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  completed_at TIMESTAMP WITH TIME ZONE,
  email_thread_id TEXT
);

-- Create ticket comments table
CREATE TABLE ticket_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  comment TEXT NOT NULL,
  is_internal BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create ticket attachments table
CREATE TABLE ticket_attachments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES ticket_comments(id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  file_url TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by UUID REFERENCES profiles(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create ticket history table
CREATE TABLE ticket_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id),
  action TEXT NOT NULL,
  field_changed TEXT,
  old_value TEXT,
  new_value TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create email queue table
CREATE TABLE email_queue (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  ticket_id UUID REFERENCES tickets(id) ON DELETE CASCADE,
  to_email TEXT NOT NULL,
  cc_emails TEXT[],
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  template_type TEXT CHECK (template_type IN ('ticket_created', 'ticket_updated', 'comment_added', 'status_changed', 'info_requested')),
  status TEXT CHECK (status IN ('pending', 'sent', 'failed')) DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- Create system settings table
CREATE TABLE system_settings (
  key TEXT PRIMARY KEY,
  value TEXT,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc', NOW())
);

-- =====================================================
-- INSERT DEFAULT DATA
-- =====================================================

-- Insert default departments
INSERT INTO departments (name, email, description) VALUES
  ('Maintenance', 'maintenance@greatlakesg.com', 'Handles all maintenance-related requests'),
  ('Electrical', 'electrical@greatlakesg.com', 'Handles all electrical-related requests');

-- Initialize system settings
INSERT INTO system_settings (key, value) VALUES
  ('last_email_check', NOW()::TEXT);

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = TIMEZONE('utc', NOW());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to automatically create profile on user signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data->>'full_name',
    'user'  -- Default role for new users
  );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user is any type of admin
CREATE OR REPLACE FUNCTION is_any_admin(user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = user_id 
    AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user can manage a specific department
CREATE OR REPLACE FUNCTION can_manage_department(user_id UUID, dept_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  user_role TEXT;
  user_dept_id UUID;
BEGIN
  SELECT role, department_id INTO user_role, user_dept_id
  FROM profiles WHERE id = user_id;
  
  IF user_role = 'global_admin' THEN
    RETURN TRUE;
  END IF;
  
  IF user_role IN ('maintenance_admin', 'electrical_admin') AND user_dept_id = dept_id THEN
    RETURN TRUE;
  END IF;
  
  RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's manageable departments
CREATE OR REPLACE FUNCTION get_user_departments(user_id UUID)
RETURNS TABLE(department_id UUID) AS $$
DECLARE
  user_role TEXT;
  user_dept_id UUID;
BEGIN
  SELECT role, department_id INTO user_role, user_dept_id
  FROM profiles WHERE id = user_id;
  
  IF user_role = 'global_admin' THEN
    RETURN QUERY SELECT id FROM departments;
  ELSIF user_role IN ('maintenance_admin', 'electrical_admin') THEN
    RETURN QUERY SELECT user_dept_id WHERE user_dept_id IS NOT NULL;
  ELSE
    RETURN;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to log ticket changes
CREATE OR REPLACE FUNCTION log_ticket_change()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO ticket_history (ticket_id, user_id, action)
    VALUES (NEW.id, NEW.created_by, 'created');
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      INSERT INTO ticket_history (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'status_changed', 'status', OLD.status, NEW.status);
      
      INSERT INTO email_queue (ticket_id, to_email, subject, body, template_type)
      VALUES (
        NEW.id,
        NEW.requester_email,
        'Ticket #' || NEW.ticket_number || ' Status Updated',
        'Your ticket status has been updated to: ' || NEW.status,
        'status_changed'
      );
    END IF;
    
    IF OLD.assigned_to IS DISTINCT FROM NEW.assigned_to THEN
      INSERT INTO ticket_history (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'assignee_changed', 'assigned_to', OLD.assigned_to::TEXT, NEW.assigned_to::TEXT);
    END IF;
    
    IF OLD.priority IS DISTINCT FROM NEW.priority THEN
      INSERT INTO ticket_history (ticket_id, user_id, action, field_changed, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'priority_changed', 'priority', OLD.priority, NEW.priority);
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to handle new comments
CREATE OR REPLACE FUNCTION handle_new_comment()
RETURNS TRIGGER AS $$
DECLARE
  ticket_record tickets;
BEGIN
  SELECT * INTO ticket_record FROM tickets WHERE id = NEW.ticket_id;
  
  IF NOT NEW.is_internal THEN
    INSERT INTO email_queue (ticket_id, to_email, subject, body, template_type)
    VALUES (
      NEW.ticket_id,
      ticket_record.requester_email,
      'New Comment on Ticket #' || ticket_record.ticket_number,
      'A new comment has been added to your ticket.',
      'comment_added'
    );
  END IF;
  
  INSERT INTO ticket_history (ticket_id, user_id, action)
  VALUES (NEW.ticket_id, NEW.user_id, CASE WHEN NEW.is_internal THEN 'internal_comment_added' ELSE 'comment_added' END);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =====================================================
-- TRIGGERS
-- =====================================================

-- Trigger for new user creation
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Create triggers for updated_at
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_assets_updated_at BEFORE UPDATE ON assets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_updated_at BEFORE UPDATE ON inventory
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_maintenance_logs_updated_at BEFORE UPDATE ON maintenance_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_departments_updated_at BEFORE UPDATE ON departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_tickets_updated_at BEFORE UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_ticket_comments_updated_at BEFORE UPDATE ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Triggers for ticket system
CREATE TRIGGER ticket_changes_trigger
  AFTER INSERT OR UPDATE ON tickets
  FOR EACH ROW EXECUTE FUNCTION log_ticket_change();

CREATE TRIGGER new_comment_trigger
  AFTER INSERT ON ticket_comments
  FOR EACH ROW EXECUTE FUNCTION handle_new_comment();

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE maintenance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_comments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE email_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- RLS POLICIES
-- =====================================================

-- Profiles policies
CREATE POLICY "Users can view profiles based on department" ON profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      id = auth.uid() OR
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin') OR
      EXISTS (
        SELECT 1 FROM profiles admin
        WHERE admin.id = auth.uid()
        AND admin.role IN ('maintenance_admin', 'electrical_admin')
        AND admin.department_id = profiles.department_id
      ) OR
      EXISTS (
        SELECT 1 FROM profiles viewer
        WHERE viewer.id = auth.uid()
        AND viewer.department_id = profiles.department_id
      )
    )
  );

CREATE POLICY "Users can update profiles based on permissions" ON profiles
  FOR UPDATE USING (
    id = auth.uid() OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin') OR
    EXISTS (
      SELECT 1 FROM profiles admin
      WHERE admin.id = auth.uid()
      AND admin.role IN ('maintenance_admin', 'electrical_admin')
      AND admin.department_id = profiles.department_id
      AND profiles.role = 'user'
    )
  );

CREATE POLICY "Admins can create users" ON profiles
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin') OR
    EXISTS (
      SELECT 1 FROM profiles admin
      WHERE admin.id = auth.uid()
      AND admin.role IN ('maintenance_admin', 'electrical_admin')
      AND admin.department_id = department_id
    )
  );

-- Department policies
CREATE POLICY "All authenticated users can view departments" ON departments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only global admins can manage departments" ON departments
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin')
  );

-- Assets policies
CREATE POLICY "All authenticated users can view assets" ON assets
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert assets" ON assets
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

CREATE POLICY "Only admins can update assets" ON assets
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

CREATE POLICY "Only admins can delete assets" ON assets
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- Inventory policies
CREATE POLICY "All authenticated users can view inventory" ON inventory
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can insert inventory items" ON inventory
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

CREATE POLICY "All authenticated users can update inventory quantities" ON inventory
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE POLICY "Only admins can delete inventory items" ON inventory
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- Maintenance logs policies
CREATE POLICY "All authenticated users can view logs" ON maintenance_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert logs" ON maintenance_logs
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own logs" ON maintenance_logs
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Admins can delete any log, users can delete own logs" ON maintenance_logs
  FOR DELETE USING (
    auth.uid() = user_id OR 
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- Inventory transactions policies
CREATE POLICY "All authenticated users can view transactions" ON inventory_transactions
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can insert transactions" ON inventory_transactions
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Tickets policies
CREATE POLICY "Users can view tickets based on department" ON tickets
  FOR SELECT USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin') OR
      EXISTS (
        SELECT 1 FROM profiles p 
        WHERE p.id = auth.uid() 
        AND p.role IN ('maintenance_admin', 'electrical_admin')
        AND p.department_id = tickets.department_id
      ) OR
      tickets.assigned_to = auth.uid() OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND p.department_id = tickets.department_id
      )
    )
  );

CREATE POLICY "Users can create tickets" ON tickets
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL AND (
      can_manage_department(auth.uid(), department_id) OR
      EXISTS (
        SELECT 1 FROM profiles p
        WHERE p.id = auth.uid()
        AND (p.department_id = department_id OR p.role = 'user')
      )
    )
  );

CREATE POLICY "Users can update tickets based on permissions" ON tickets
  FOR UPDATE USING (
    auth.uid() = assigned_to OR 
    can_manage_department(auth.uid(), department_id)
  );

CREATE POLICY "Department admins can delete their tickets" ON tickets
  FOR DELETE USING (
    can_manage_department(auth.uid(), department_id)
  );

-- Ticket comments policies
CREATE POLICY "All authenticated users can view comments" ON ticket_comments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can create comments" ON ticket_comments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update own comments" ON ticket_comments
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own comments or admins can delete any" ON ticket_comments
  FOR DELETE USING (
    auth.uid() = user_id OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- Ticket attachments policies
CREATE POLICY "All authenticated users can view attachments" ON ticket_attachments
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "All authenticated users can upload attachments" ON ticket_attachments
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can delete own attachments or admins can delete any" ON ticket_attachments
  FOR DELETE USING (
    auth.uid() = uploaded_by OR
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- Ticket history policies
CREATE POLICY "All authenticated users can view history" ON ticket_history
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can insert history" ON ticket_history
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- Email queue policies
CREATE POLICY "Only admins can view email queue" ON email_queue
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

-- System settings policies
CREATE POLICY "Only admins can view system settings" ON system_settings
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('global_admin', 'maintenance_admin', 'electrical_admin'))
  );

CREATE POLICY "Only global admins can modify system settings" ON system_settings
  FOR ALL USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'global_admin')
  );

-- =====================================================
-- VIEWS
-- =====================================================

CREATE OR REPLACE VIEW user_permissions AS
SELECT 
  p.id,
  p.email,
  p.full_name,
  p.role,
  p.department_id,
  d.name as department_name,
  CASE 
    WHEN p.role = 'global_admin' THEN 'All Departments'
    WHEN p.role IN ('maintenance_admin', 'electrical_admin') THEN d.name || ' Department'
    ELSE 'No Admin Access'
  END as admin_scope,
  p.created_at
FROM profiles p
LEFT JOIN departments d ON p.department_id = d.id;

-- Grant access to the view
GRANT SELECT ON user_permissions TO authenticated;

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

CREATE INDEX idx_tickets_department ON tickets(department_id);
CREATE INDEX idx_tickets_assigned_to ON tickets(assigned_to);
CREATE INDEX idx_tickets_status ON tickets(status);
CREATE INDEX idx_tickets_requester_email ON tickets(requester_email);
CREATE INDEX idx_ticket_comments_ticket ON ticket_comments(ticket_id);
CREATE INDEX idx_ticket_history_ticket ON ticket_history(ticket_id);
CREATE INDEX idx_email_queue_status ON email_queue(status);
CREATE INDEX idx_email_queue_ticket ON email_queue(ticket_id);
CREATE INDEX idx_profiles_department ON profiles(department_id);
CREATE INDEX idx_profiles_role ON profiles(role);

-- =====================================================
-- FINAL SETUP MESSAGE
-- =====================================================

DO $$
DECLARE
  admin_count INTEGER;
  user_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO admin_count FROM profiles WHERE role = 'global_admin';
  SELECT COUNT(*) INTO user_count FROM profiles;
  
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Database setup complete!';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Tables created: 15';
  RAISE NOTICE 'Functions created: 9';
  RAISE NOTICE 'Triggers created: 10';
  RAISE NOTICE 'Policies created: 30+';
  RAISE NOTICE 'Departments created: 2 (Maintenance, Electrical)';
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Current users in system: %', user_count;
  RAISE NOTICE 'Current global admins: %', admin_count;
  RAISE NOTICE '========================================';
  RAISE NOTICE 'Next steps:';
  RAISE NOTICE '1. Update existing users to global_admin role if needed';
  RAISE NOTICE '2. Assign department admins';
  RAISE NOTICE '3. Configure Microsoft Graph API credentials';
  RAISE NOTICE '========================================';
END $$;

-- =====================================================
-- POST-SETUP: Update existing users (run separately)
-- =====================================================

-- Example: Make your account a global admin
-- UPDATE profiles SET role = 'global_admin' WHERE email = 'elau@greatlakesg.com';

-- Example: Assign department admins
-- UPDATE profiles 
-- SET role = 'maintenance_admin', 
--     department_id = (SELECT id FROM departments WHERE name = 'Maintenance')
-- WHERE email = 'maintenance.admin@greatlakesg.com';

-- UPDATE profiles 
-- SET role = 'electrical_admin',
--     department_id = (SELECT id FROM departments WHERE name = 'Electrical')
-- WHERE email = 'electrical.admin@greatlakesg.com';