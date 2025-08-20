# Asset Tracker Application

A comprehensive web application for tracking assets, inventory, and maintenance logs with user authentication and role-based permissions.

## Features

- **User Authentication**: Secure login and registration with role-based access control
- **Asset Management**: Track equipment and assets with detailed information
- **Inventory System**: Monitor stock levels with low-stock alerts
- **Maintenance Logs**: Record maintenance, repairs, and inspections with material tracking
- **User Roles**: Admin and regular user permissions
- **Dashboard**: Overview of system status and quick actions

## Tech Stack

- **Frontend**: React + Vite
- **Styling**: Tailwind CSS
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Icons**: Lucide React

## Setup Instructions

### 1. Prerequisites

- Node.js (v16 or higher)
- npm or yarn
- Supabase account

### 2. Supabase Setup

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor in your Supabase dashboard
3. Run the SQL schema from `supabase-schema.sql` to create all necessary tables and policies
4. Get your project URL and anon key from Settings > API

### 3. Environment Configuration

1. Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

2. Update `.env` with your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 4. Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:5173`

## User Permissions

### Admin Users
- Add, edit, and delete assets
- Add and remove inventory items
- Adjust inventory quantities
- Delete any maintenance logs
- Manage user roles
- Access user management panel

### Regular Users
- View all assets and inventory
- Adjust inventory quantities (add/remove stock)
- Add maintenance logs
- Edit and delete their own logs
- Cannot delete inventory items or assets

## First Admin User

To create the first admin user:

1. Register a new account through the application
2. Go to your Supabase dashboard
3. Navigate to Table Editor > profiles
4. Find your user and change the `role` from 'user' to 'admin'

## Project Structure

```
src/
├── components/
│   ├── Layout.jsx          # Main layout with navigation
│   ├── PrivateRoute.jsx    # Protected route wrapper
│   ├── AssetForm.jsx       # Asset add/edit form
│   ├── InventoryForm.jsx   # Inventory add/edit form
│   ├── LogForm.jsx         # Maintenance log form
│   └── AdjustQuantityModal.jsx # Inventory adjustment modal
├── contexts/
│   └── AuthContext.jsx     # Authentication context provider
├── lib/
│   └── supabase.js         # Supabase client configuration
├── pages/
│   ├── Login.jsx           # Login page
│   ├── Register.jsx        # Registration page
│   ├── Dashboard.jsx       # Main dashboard
│   ├── Assets.jsx          # Assets management
│   ├── Inventory.jsx       # Inventory management
│   ├── Logs.jsx            # Maintenance logs
│   └── Users.jsx           # User management (admin only)
└── App.jsx                 # Main app component with routing
```

## Database Schema

The application uses the following main tables:

- `profiles`: User profiles with roles
- `assets`: Equipment and asset tracking
- `inventory`: Inventory items and stock levels
- `maintenance_logs`: Maintenance and repair logs
- `inventory_transactions`: Track inventory adjustments

All tables have Row Level Security (RLS) policies to ensure proper access control.

## Development

```bash
# Run development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## License

MIT
