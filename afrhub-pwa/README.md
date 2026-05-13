# AfrHub POS - Progressive Web App

A mobile-first, offline-capable Point of Sale (POS) and business management PWA for small traders in Africa.

## Features

### Core Capabilities
- **Offline-First Architecture**: Works completely offline with automatic sync when online
- **Multi-Currency Support**: XAF, XOF, NGN, GHS, KES, TZS, ZAR, USD, EUR
- **Multi-Language**: English, French, Portuguese, Swahili
- **Progressive Web App**: Install on any device directly from browser
- **Real-time Sync**: Background synchronization with conflict resolution

### Business Modules
- **POS Terminal**: Fast checkout with split payments, mobile money integration
- **Inventory Management**: Products, variants, batches, barcode scanning
- **Client Management**: CRM, credit tracking, loyalty programs
- **Expense Tracking**: Categorize and monitor business expenses
- **Reports & Analytics**: Sales, profit, inventory insights
- **Chat Reports**: Natural language reporting ("Show today's profit")

### Technical Highlights
- **Local Database**: IndexedDB via Dexie for offline storage
- **Service Worker**: Asset caching and network interception
- **State Management**: Zustand with persistence
- **UI Framework**: React + TypeScript + Tailwind CSS
- **Charts**: Recharts for data visualization
- **PDF Generation**: Receipt and report generation

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS
- **State**: Zustand, TanStack Query
- **Database**: Dexie (IndexedDB wrapper)
- **PWA**: Vite Plugin PWA with Workbox
- **Icons**: Lucide React
- **Date Handling**: date-fns

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
cd afrhub-pwa

# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview
```

### Environment Variables

Create a `.env` file:

```env
VITE_API_URL=https://api.afrhub.com
```

## Project Structure

```
afrhub-pwa/
├── src/
│   ├── components/       # Reusable UI components
│   │   └── MainLayout.tsx
│   ├── pages/           # Page components
│   │   ├── Dashboard.tsx
│   │   ├── POS.tsx
│   │   ├── Inventory.tsx
│   │   └── ...
│   ├── services/        # Business logic & API
│   │   ├── database.ts  # IndexedDB setup
│   │   └── sync.ts      # Sync service
│   ├── store/           # State management
│   │   └── appStore.ts
│   ├── types/           # TypeScript definitions
│   │   └── index.ts
│   ├── utils/           # Helper functions
│   │   └── helpers.ts
│   ├── App.tsx          # Main app component
│   ├── main.tsx         # Entry point
│   └── index.css        # Global styles
├── public/              # Static assets
├── index.html
├── package.json
├── tailwind.config.js
├── vite.config.ts
└── tsconfig.json
```

## Key Services

### Database Service (`src/services/database.ts`)
- IndexedDB setup with Dexie
- Offline-first data operations
- Sync queue management
- Helper functions for CRUD operations

### Sync Service (`src/services/sync.ts`)
- Automatic background sync
- Conflict resolution
- Online/offline detection
- Daily summary calculation

### State Management (`src/store/appStore.ts`)
- User authentication state
- Store and currency settings
- Online status tracking
- Persistent preferences

## PWA Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline Support**: Full functionality without internet
- **Push Notifications**: Ready for backend integration
- **Auto Updates**: Service worker updates automatically
- **Responsive**: Mobile-first design

## African Market Focus

### Currencies
- Central/West Africa: XAF, XOF
- Nigeria: NGN (₦)
- Ghana: GHS (₵)
- Kenya: KES (KSh)
- Tanzania: TZS (TSh)
- South Africa: ZAR (R)

### Payment Methods
- Cash
- Mobile Money (M-Pesa, Airtel Money, MTN Mobile Money)
- Card (with hardware)
- Credit/Accounts

### Languages
- English
- French
- Portuguese
- Swahili

## Development

```bash
# Run linter
npm run lint

# Type check
npx tsc --noEmit

# Build and analyze
npm run build
```

## Deployment

The PWA can be hosted on any static hosting platform:

- Vercel
- Netlify
- GitHub Pages
- AWS S3 + CloudFront
- Firebase Hosting

**Important**: HTTPS is required for PWA features (service worker, etc.)

## Backend Integration

This PWA is designed to work with the AfrHub backend:
- **REST API**: For standard CRUD operations
- **GraphQL**: For complex queries and subscriptions
- **Sync Endpoint**: For offline data synchronization
- **WhatsApp Gateway**: For automated reports

## License

Proprietary - AfrHub 2024

## Support

For questions or issues, contact: support@afrhub.com
