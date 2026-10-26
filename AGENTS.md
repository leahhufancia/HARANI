# Harani Project - Agent Notes

## Project Overview

Harani is a complete farmer-to-buyer marketplace built with React.js and Supabase. It connects local vegetable farmers with nearby buyers including households, carenderias, restaurants, and other food businesses.

## Technology Stack

- **Frontend**: React.js, Vite, Tailwind CSS, React Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Maps**: React Leaflet, Leaflet
- **Icons**: Lucide React
- **Forms**: React Hook Form, Zod
- **Charts**: Recharts

## Key Features

### Public
- Landing page with platform information
- User registration (farmer or buyer roles)
- Login and password reset
- Role-based authentication

### Farmer Workspace
- Dashboard with statistics
- My Harvest - manage produce listings
- Add Produce - create new listings with details
- Reservations - manage incoming requests
- Sales & Handover - track sales and complete transactions
- Notifications - account-specific updates
- Profile management

### Buyer Marketplace
- Marketplace with search, filters, and sorting
- Produce detail pages
- Partial-quantity reservations
- Interactive map (React Leaflet)
- My Reservations - track reservations
- My Purchases - view transaction history
- Notifications
- Profile management

### Administrator Area
- Dashboard with platform statistics
- User management
- Account verification
- Listing oversight
- Reservation and transaction oversight
- Activity reports
- Audit history

## Project Structure

```
src/
├── components/
│   ├── common/          # Shared components (DigitalHarvestPass)
│   ├── forms/           # Form components
│   ├── marketplace/     # Marketplace-specific components
│   ├── map/            # Map components (MarketplaceMap)
│   └── navigation/     # Navigation components
├── layouts/            # Page layouts (Public, Farmer, Buyer, Admin)
├── pages/
│   ├── public/         # Landing page
│   ├── auth/           # Login, Register, ForgotPassword
│   ├── farmer/         # Farmer workspace pages
│   ├── buyer/          # Buyer marketplace pages
│   └── admin/          # Administrator pages
├── context/            # React context (AuthContext)
├── hooks/              # Custom React hooks
├── services/           # API service modules
├── lib/                # Utility libraries (Supabase client)
├── utils/              # Helper functions
└── routes/             # Route configurations
```

## Database Schema

### Main Tables
- `profiles` - User profiles with role information
- `produce_categories` - Categories for produce listings
- `produce_listings` - Farmer produce listings
- `listing_images` - Images for produce listings
- `reservations` - Buyer reservations for produce
- `harvest_passes` - Digital harvest passes for verified transactions
- `handover_verifications` - Handover verification records
- `notifications` - User notifications
- `verification_submissions` - Account verification documents
- `audit_logs` - Administrative action logs

### Key Database Functions
- `create_reservation` - Atomic reservation with inventory check
- `confirm_reservation` - Confirm pending reservation
- `reject_reservation` - Reject reservation with reason
- `cancel_reservation` - Cancel reservation (buyer action)
- `complete_handover` - Complete transaction and generate harvest pass
- `verify_harvest_pass` - Verify harvest pass code
- `process_expired_reservations` - Process expired reservations

## Development Commands

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

## Environment Variables

```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Brand Identity

### Colors
- Black: `#000000`
- White: `#FFFFFF`
- Green: `#159600`
- Yellow: `#D0BE00`

### Typography
- Primary: Manrope
- Secondary: DM Sans

## Security Features

- Row Level Security (RLS) on all tables
- Role-based access control enforced in database
- Protected routes in React Router
- Input validation with Zod
- Secure password handling via Supabase Auth
- Audit logging for admin actions

## Important Implementation Notes

### Atomic Inventory Management
The reservation system uses database functions with row locking to prevent overselling:
- `create_reservation` uses `FOR UPDATE` to lock the listing row
- Calculates available quantity as: listed - reserved - sold
- Rejects requests if insufficient stock
- All inventory changes are atomic

### Reservation Lifecycle
States: `pending` → `confirmed` → `ready` → `completed`
Other states: `rejected`, `cancelled`, `expired`

### Partial Quantity Reservations
Buyers can reserve portions of a listing:
- Example: 50kg listing can have multiple 5kg, 15kg, etc. reservations
- Available quantity updates dynamically
- Stock released on cancellation/rejection/expiration

### Digital Harvest Pass
Generated when reservation is ready for handover:
- Unique verification code
- QR code support
- Verification records who and when
- Prevents duplicate verification

### Notification System
Notifications are created automatically for:
- New reservations (farmer)
- Reservation confirmations (buyer)
- Cancellations (both parties)
- Expirations (both parties)
- Handover completions (both parties)

## Testing Checklist

### Authentication
- [ ] Register as farmer
- [ ] Register as buyer
- [ ] Login/logout
- [ ] Password reset
- [ ] Role-based redirects

### Farmer Workflow
- [ ] Create listing
- [ ] Edit listing
- [ ] View in My Harvest
- [ ] Receive reservation
- [ ] Confirm reservation
- [ ] Complete handover

### Buyer Workflow
- [ ] Browse marketplace
- [ ] Search/filter listings
- [ ] View produce details
- [ ] Make reservation
- [ ] View map
- [ ] Track reservation
- [ ] View purchases

### Inventory
- [ ] Multiple buyers reserve same listing
- [ ] Verify no overselling
- [ ] Test cancellation
- [ ] Test expiration

### Security
- [ ] Cannot access other users' data
- [ ] RLS policies working
- [ ] Unauthorized actions blocked

### Admin
- [ ] View all users
- [ ] Verify accounts
- [ ] Moderate listings
- [ ] View audit logs

## Current Status

The application is **functionally complete** with all UI components, pages, database schema, and service layer implemented. To make it fully functional:

1. Set up Supabase project
2. Run schema.sql to create tables
3. Run functions.sql to create database functions
4. Configure .env with Supabase credentials
5. Uncomment service imports in pages
6. Test workflows with real data

## Common Issues

### Map Not Loading
Ensure Leaflet CSS is imported in the map component. It's already imported in MarketplaceMap.jsx.

### Permission Errors
Check that RLS policies have been executed in Supabase SQL Editor.

### Environment Variables
Restart dev server after adding .env file. Variable names are case-sensitive.

### Database Functions
Both schema.sql and functions.sql must be executed in order.

## Deployment

### Build
```bash
npm run build
```

### Deploy
Deploy the `dist` folder to any static hosting service (Vercel, Netlify, etc.)

### Production Setup
1. Create production Supabase project
2. Run schema and functions
3. Update environment variables
4. Build and deploy
5. Configure hosting redirects if needed

## Resources

- Setup Guide: SETUP_GUIDE.md
- Implementation Status: IMPLEMENTATION_STATUS.md
- Database Schema: supabase/schema.sql
- Database Functions: supabase/functions.sql
- Supabase Docs: https://supabase.com/docs
- React Router Docs: https://reactrouter.com
- Tailwind CSS Docs: https://tailwindcss.com
