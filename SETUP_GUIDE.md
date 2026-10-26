# Harani Setup Guide

This guide will help you set up Harani from scratch with Supabase backend.

## Prerequisites

- Node.js 18+ installed
- npm or yarn package manager
- A Supabase account (free tier is sufficient)

## Step 1: Project Setup

The project has already been initialized with Vite and all required dependencies installed.

```bash
cd hackathon
npm install
```

## Step 2: Supabase Setup

### Create a Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign up or log in
3. Click "New Project"
4. Fill in the project details:
   - Name: `harani`
   - Database Password: (choose a strong password)
   - Region: Choose the closest region to your users
5. Wait for the project to be created (2-3 minutes)

### Get Your Credentials

1. Go to Project Settings > API
2. Copy the following:
   - Project URL
   - anon public key (public anon key)

### Configure Environment Variables

1. Copy the example environment file:
```bash
cp .env.example .env
```

2. Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## Step 3: Database Setup

### Run the Schema

1. In your Supabase dashboard, go to the SQL Editor
2. Click "New Query"
3. Open `supabase/schema.sql` from this project
4. Copy the entire SQL script
5. Paste it into the SQL Editor
6. Click "Run" to execute the schema

This will create:
- All required tables (profiles, produce_listings, reservations, etc.)
- Row Level Security (RLS) policies
- Indexes for performance
- Default produce categories

### Run the Database Functions

1. In the SQL Editor, create a new query
2. Open `supabase/functions.sql` from this project
3. Copy the entire SQL script
4. Paste it into the SQL Editor
5. Click "Run" to execute the functions

This will create:
- Atomic reservation creation function
- Reservation confirmation/rejection/cancellation functions
- Handover completion function
- Harvest pass verification function
- Expired reservation processing function

### Set Up Storage (Optional)

If you want to enable image uploads:

1. In Supabase dashboard, go to Storage
2. Create a new bucket named `listing-images`
3. Make it public (for now, for development)
4. Configure bucket policies as needed

## Step 4: Create an Admin User

You'll need an admin user to access the administrator area:

1. Go to Authentication > Users in Supabase
2. Click "Add User"
3. Create a new user with your email
4. After creation, go to the SQL Editor
5. Run this query to set the user as admin:

```sql
UPDATE public.profiles
SET role = 'admin'
WHERE email = 'your-admin-email@example.com';
```

## Step 5: Start the Development Server

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Step 6: Test the Application

### Test Registration

1. Open `http://localhost:5173` in your browser
2. Click "Get Started"
3. Choose "Farmer" or "Buyer"
4. Fill in the registration form
5. Submit the form

### Test Login

1. Click "Log In"
2. Enter your credentials
3. You should be redirected to the appropriate dashboard

### Test Admin Access

1. Log in with your admin user
2. You should see the admin dashboard

## Troubleshooting

### "Relation does not exist" errors

This means the database schema hasn't been set up. Run the `schema.sql` script in the Supabase SQL Editor.

### "Permission denied" errors

This is likely an RLS policy issue. Check that:
- The RLS policies in `schema.sql` have been executed
- Your user has the correct role in the profiles table

### Map not loading

React Leaflet requires the CSS to be imported. It's already imported in `MarketplaceMap.jsx`. If you still have issues, check the browser console for specific errors.

### Environment variables not loading

Make sure:
- You created a `.env` file (not `.env.example`)
- You restarted the dev server after adding the variables
- The variable names match exactly (case-sensitive)

## Next Steps

After setup:

1. **Test Farmer Workflow**:
   - Register as a farmer
   - Add a produce listing
   - Check it appears in My Harvest

2. **Test Buyer Workflow**:
   - Register as a buyer
   - Browse the marketplace
   - Make a reservation

3. **Test Admin Workflow**:
   - Log in as admin
   - Review users and listings
   - Check activity reports

4. **Connect Real Data**:
   - Uncomment the service imports in pages
   - Implement actual API calls
   - Test with real database records

## Development Tips

- The dev server auto-reloads on file changes
- Check the browser console for errors
- Use the Supabase dashboard to inspect database records
- Test with different user roles to verify permissions

## Production Deployment

When ready to deploy:

1. Set up a production Supabase project
2. Update environment variables with production credentials
3. Build the project: `npm run build`
4. Deploy the `dist` folder to your hosting service (Vercel, Netlify, etc.)
5. Update any redirect configurations in your hosting service

## Support

If you encounter issues:
1. Check the browser console for errors
2. Verify Supabase credentials are correct
3. Ensure database schema and functions are executed
4. Check that RLS policies are working as expected
