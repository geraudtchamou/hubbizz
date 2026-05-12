# AfriHub Backend - FastAPI API Server

Low-bandwidth optimized backend for African SME platform with geospatial search, trust scoring, and WhatsApp commerce integration.

## Features

- ✅ **FastAPI** async API with automatic OpenAPI docs
- ✅ **PostgreSQL + PostGIS** for geospatial queries (nearby search, radius filtering)
- ✅ **Trust Score Algorithm** with AI fraud detection
- ✅ **Image Optimization** for low-bandwidth markets (WebP compression, data URIs)
- ✅ **WhatsApp Commerce** integration ready
- ✅ **Payment Gateway** support (Flutterwave, Paystack, Mobile Money)
- ✅ **Redis Caching** for sub-2s response times
- ✅ **JWT Authentication** with phone-based login

## Quick Start

### Prerequisites

```bash
# Install system dependencies
sudo apt-get update
sudo apt-get install -y postgresql postgresql-contrib postgis redis-server

# Or use Docker (recommended)
docker-compose up -d postgres redis
```

### Installation

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # Linux/Mac
# or: venv\Scripts\activate  # Windows

# Install dependencies
pip install -r requirements.txt

# Copy environment config
cp .env.example .env

# Edit .env with your credentials
nano .env

# Run database migrations
alembic upgrade head

# Start development server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Access API Documentation

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- Health Check: http://localhost:8000/health

## Project Structure

```
backend/
├── app/
│   ├── api/              # API route handlers
│   │   ├── businesses.py    # Business CRUD, search, leads
│   │   ├── auth.py          # Authentication endpoints
│   │   ├── payments.py      # Payment processing
│   │   ├── maps.py          # Geospatial APIs
│   │   └── reviews.py       # Review management
│   ├── models/           # SQLAlchemy ORM models
│   │   └── core.py          # User, Business, Product, etc.
│   ├── schemas/          # Pydantic validation schemas
│   │   └── core.py          # Request/Response models
│   ├── services/         # Business logic
│   │   ├── trust_score.py   # Trust score calculation
│   │   └── image_optimizer.py # Low-bandwidth image optimization
│   ├── utils/            # Helper functions
│   ├── db.py             # Database configuration
│   └── main.py           # FastAPI application
├── tests/                # Unit and integration tests
├── requirements.txt      # Python dependencies
├── .env.example          # Environment template
└── README.md
```

## Key API Endpoints

### Businesses

```bash
# Create business profile
POST /api/v1/businesses/
{
  "name": "Kam's Plumbing Services",
  "category": "Home Services",
  "latitude": 4.0511,
  "longitude": 9.7679,
  "city": "Douala",
  "country": "CM",
  "phone": "+237670123456",
  "whatsapp_number": "+237670123456"
}

# Search with geospatial filters
GET /api/v1/businesses/search?query=plumber&latitude=4.0511&longitude=9.7679&radius_km=5&is_verified=true

# Get nearby businesses (optimized for map view)
GET /api/v1/businesses/nearby?latitude=4.0511&longitude=9.7679&radius_km=10&category=Home%20Services

# Create lead (WhatsApp click tracking)
POST /api/v1/businesses/{business_id}/leads
{
  "lead_type": "whatsapp_click",
  "source": "search",
  "channel": "whatsapp"
}
```

### Trust Score

The trust score algorithm calculates a 0-100 score based on:

- **Verification (25%)**: Phone, email, license, address, tax ID
- **Reviews (30%)**: Rating, count, recency, verified purchases
- **Response Time (15%)**: Average WhatsApp/response time
- **Completion Rate (15%)**: Order completion percentage
- **Activity (10%)**: Recent activity, profile completeness
- **AI Fraud Detection (-10 to +5)**: Pattern analysis, account age

Auto-recalculated on business updates, or manually triggered:

```bash
POST /api/v1/businesses/{id}/recalculate-trust
```

## Low-Bandwidth Optimizations

### Image Optimization

All images are automatically:
- Resized to appropriate dimensions (thumbnails: 200x200, gallery: 800x600)
- Converted to WebP format (60% smaller than JPEG)
- Compressed to <100KB for thumbnails
- Returned as data URIs for offline PWA caching

```python
from app.services.image_optimizer import optimize_image_url

optimized = await optimize_image_url(
    "https://example.com/large-image.jpg",
    target_size=(200, 200),
    quality=75,
    format="WEBP"
)
# Returns: data:image/webp;base64,...
```

### Response Optimization

- Lightweight search results (only essential fields)
- Pagination with configurable limits
- Conditional responses based on `Accept` header
- Gzip compression enabled by default

## Database Schema

Core entities:
- **User**: Phone-based auth, verification levels
- **Business**: Profiles with trust scores, PostGIS location
- **Product**: Catalog items with inventory
- **Lead**: WhatsApp clicks, quote requests, conversions
- **Review**: Moderated reviews with spam detection
- **Transaction**: Escrow payments, delivery tracking
- **Verification**: Document verification workflow
- **AnalyticsEvent**: BI dashboard data

See `app/models/core.py` for full schema.

## Testing

```bash
# Run unit tests
pytest tests/unit -v

# Run integration tests (requires test database)
pytest tests/integration -v

# Generate coverage report
pytest --cov=app --cov-report=html
```

## Production Deployment

### Environment Variables

Set these in production:

```bash
APP_ENV=production
DEBUG=false
DATABASE_URL=postgresql+asyncpg://user:pass@prod-db:5432/afrhub
REDIS_URL=redis://prod-redis:6379/0
JWT_SECRET_KEY=<strong-random-key>
```

### Docker Deployment

```bash
# Build image
docker build -t afrhub-backend .

# Run with Docker Compose
docker-compose -f docker-compose.prod.yml up -d
```

### Performance Tuning

For high-traffic deployments:

1. **Database**: Add read replicas, connection pooling (PgBouncer)
2. **Cache**: Redis cluster for session/storage
3. **CDN**: Cloudflare for static assets + edge caching
4. **Workers**: Gunicorn with uvicorn workers (4-16 depending on CPU)
5. **Monitoring**: Sentry for errors, Prometheus for metrics

## Integrations

### WhatsApp Business API

```python
# Send automated quote response
from app.services.whatsapp import send_whatsapp_message

await send_whatsapp_message(
    to="+237670123456",
    message="Thank you for your inquiry! Our plumber will arrive within 30 minutes."
)
```

### Payment Gateways

Supports multiple African payment providers:

- **Flutterwave**: Cards, bank transfer, mobile money
- **Paystack**: Cards, bank transfer
- **Orange Money**: Direct mobile money (CM, SN, CI)
- **MTN Mobile Money**: Direct mobile money (CM, NG, GH, KE)

```python
# Initialize escrow payment
from app.services.payments import create_escrow_transaction

transaction = await create_escrow_transaction(
    amount=50000,
    currency="XAF",
    buyer_id=user_id,
    seller_id=business_id,
    release_conditions={"delivery_confirmed": True}
)
```

## Security

- JWT tokens with short expiry (30 min access, 7 day refresh)
- Password hashing with bcrypt
- SQL injection prevention (SQLAlchemy ORM)
- XSS protection (Pydantic validation)
- Rate limiting per IP
- CORS configuration per environment

## Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## License

MIT License - see LICENSE file for details

## Support

For issues and questions:
- GitHub Issues: https://github.com/afrhub/backend/issues
- Email: tech@afrhub.africa
- Documentation: https://docs.afrhub.africa

---

Built with ❤️ for African SMEs | Cameroon 🇨🇲 Nigeria 🇳🇬 Kenya 🇰🇪 Ghana 🇬🇭
