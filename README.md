# Harani - Farmer-to-Buyer Marketplace

A complete React.js web platform connecting local vegetable farmers with nearby buyers.

## Tech Stack

- **Frontend**: React.js, Vite, Tailwind CSS, React Router
- **Backend**: Supabase (PostgreSQL, Auth, Storage)
- **Maps**: React Leaflet, Leaflet
- **Icons**: Lucide React
- **Forms**: React Hook Form, Zod
- **Charts**: Recharts

## Getting Started

### Prerequisites

- Node.js 18+ installed
- A Supabase account (free tier works)

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd hackathon
```

2. Install dependencies:
```bash
npm install
```

3. Set up Supabase:
   - Create a new project at [supabase.com](https://supabase.com)
   - Go to Project Settings > API
   - Copy your project URL and anon key

4. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and add your Supabase credentials:
```
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

5. Set up the database:
   - Go to your Supabase project's SQL Editor
   - Open `supabase/schema.sql`
   - Run the entire SQL script to create tables and policies

6. Start the development server:
```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Database Schema

The application uses the following main tables:

- `profiles` - User profiles with role information (farmer, buyer, admin)
- `produce_categories` - Categories for produce listings
- `produce_listings` - Farmer produce listings
- `listing_images` - Images for produce listings
- `reservations` - Buyer reservations for produce
- `harvest_passes` - Digital harvest passes for verified transactions
- `handover_verifications` - Handover verification records
- `notifications` - User notifications
- `verification_submissions` - Account verification documents
- `audit_logs` - Administrative action logs

## Features

### Public
- Landing page with platform information
- User registration (farmer or buyer)
- Login and password reset

### Farmer Workspace
- Dashboard with overview statistics
- My Harvest - manage produce listings
- Add Produce - create new listings
- Reservations - manage incoming reservation requests
- Sales & Handover - track sales and complete handovers
- Notifications - account-specific notifications
- Profile management

### Buyer Marketplace
- Marketplace with search and filters
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

## Security

- Row Level Security (RLS) enabled on all tables
- Role-based access control enforced in database
- Separate layouts for each user role
- Protected routes in React Router
- Input validation with Zod

## Development

### File Structure

```
src/
├── components/        # Reusable components
├── layouts/          # Page layouts (Public, Farmer, Buyer, Admin)
├── pages/            # Page components
│   ├── public/       # Public pages
│   ├── auth/         # Authentication pages
│   ├── farmer/       # Farmer workspace
│   ├── buyer/        # Buyer marketplace
│   └── admin/        # Administrator area
├── context/          # React context providers
├── hooks/            # Custom React hooks
├── services/         # API service modules
├── lib/              # Utility libraries
├── utils/            # Helper functions
└── routes/           # Route configurations
```

### Adding New Features

1. Create component in appropriate directory
2. Add route in `App.jsx`
3. Add navigation link in layout
4. Implement backend service functions
5. Add RLS policies if needed
6. Test with both farmer and buyer accounts

## Testing

To run tests (when implemented):
```bash
npm run test
```

## Building for Production

```bash
npm run build
```

The build output will be in the `dist` directory.

## Deployment

### Vercel (Recommended)

1. Push code to GitHub
2. Import project in Vercel
3. Add environment variables in Vercel dashboard
4. Deploy

### Other Platforms

Build the project and deploy the `dist` folder to any static hosting service.

## License

MIT

## Support

For issues and questions, please contact the development team.
