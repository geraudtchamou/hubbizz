# AfriHub Frontend

Mobile-first PWA for African SME discovery and commerce.

## Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **Maps**: Leaflet + OpenStreetMap
- **State**: React Hooks + SWR
- **Offline**: Service Workers + IndexedDB
- **PWA**: Web App Manifest

## Getting Started

### Prerequisites

- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Start development server
npm run dev
```

### Build for Production

```bash
# Build optimized bundle
npm run build

# Analyze bundle size
npm run analyze

# Start production server
npm start
```

## Key Features

### Low-Bandwidth Optimizations

- **Service Worker**: Offline-first caching strategy
- **Image Optimization**: WebP format, lazy loading
- **IndexedDB**: Local caching of business data
- **API Retry Logic**: Exponential backoff for unstable networks
- **Debounced Search**: Reduces API calls

### PWA Capabilities

- Installable on mobile devices
- Offline mode with cached content
- Push notifications ready
- Background sync for leads

### Accessibility

- Touch-friendly targets (44px minimum)
- ARIA labels on interactive elements
- Keyboard navigation support
- High contrast trust badges

## Project Structure

```
frontend/
├── app/                 # Next.js App Router pages
│   ├── layout.tsx       # Root layout
│   └── page.tsx         # Home page
├── components/          # Reusable UI components
│   ├── BusinessCard.tsx
│   ├── TrustBadge.tsx
│   ├── SearchBar.tsx
│   └── MapView.tsx
├── lib/                 # Utilities and API clients
│   ├── api.ts           # API client with caching
│   ├── config.ts        # Configuration constants
│   ├── hooks.ts         # Custom React hooks
│   └── types.ts         # TypeScript types
├── public/              # Static assets
│   ├── manifest.json    # PWA manifest
│   ├── sw.js            # Service worker
│   └── offline.html     # Offline fallback page
└── styles/              # Global styles
    └── globals.css
```

## Performance Targets

- **First Contentful Paint**: < 1.5s on 3G
- **Time to Interactive**: < 3s on 3G
- **Bundle Size**: < 200KB initial load
- **Lighthouse Score**: > 90

## Testing

```bash
# Run unit tests
npm test

# Run with coverage
npm test -- --coverage
```

## Deployment

### Vercel (Recommended)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel
```

### Docker

```bash
# Build image
docker build -t afrihub-frontend .

# Run container
docker run -p 3000:3000 afrihub-frontend
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_API_URL` | Backend API URL | Yes |
| `NEXT_PUBLIC_FLUTTERWAVE_KEY` | Flutterwave public key | No |
| `NEXT_PUBLIC_PAYSTACK_KEY` | Paystack public key | No |
| `NEXT_PUBLIC_WHATSAPP_BUSINESS_ID` | WhatsApp Business ID | No |

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License - see LICENSE file for details
