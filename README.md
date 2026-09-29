# Kit-3: Omnichannel Retail Management System

SvelteKit 5 + Svelte 5 + TypeScript | Couchbase Capella | PartyKit | Multi-device (POS/Web/TV)

A comprehensive retail management platform supporting both POS (Point of Sale) operations and e-commerce with inventory tracking, order management, and real-time synchronization.

---

## Project Status

### Completed Phases
- ✅ **Phase 1**: Foundation Authentication (JWT, email/password, route protection)
- ✅ **Phase 2**: Authorization & Role Management (RBAC with permission scoping)
- ✅ **Phase 3**: UI/UX Design Foundation (tokenized components, design system)
- ✅ **Phase 4**: Core Retail Data Model (inventory, orders, suppliers, pricing, POS, stock takes)

### In Progress
- 🔄 **Phase 5**: Omnichannel E-commerce + Realtime Layer (storefront, PartyKit sync)

---

## Setup

### Prerequisites
- Node.js 18+
- Couchbase Capella account (or local Couchbase Server)
- PartyKit account (for real-time features)

### Installation

```bash
npm install
```

### Environment Configuration

Create a `.env` file in the project root:

```env
# Couchbase Capella
CB_CLUSTER_ID=your_cluster_id
CB_USERNAME=your_username
CB_PASSWORD=your_password
CB_BUCKET_NAME=kit-3
CB_SCOPE_NAME=retail
CB_COLLECTION_NAME=default

# Vault (for sensitive data encryption)
CB_COLLECTION_NAME_VAULT=vault
VAULT_PASSWORD=your_vault_password

# Email & Auth
EMAIL_OWNER=owner@example.com
PASSWORD_OWNER=secure_password
USERNAME_OWNER=owner

# API Keys
JWT_SECRET=your_jwt_secret_key

# PartyKit (for real-time sync)
PARTYKIT_HOST=party.example.com
PARTYKIT_PUBLIC_HOST=party.example.com
```

### Database Initialization

The application auto-initializes Couchbase indexes on first run. Ensure your Capella cluster credentials are correct before starting the dev server.

---

## Development

### Start Dev Server

```bash
npm run dev

# or with specific port
npm run dev -- --port 3001

# with auto-open in browser
npm run dev -- --open
```

Dev server runs on `https://localhost:3000` by default.

### Type Checking

```bash
# Check TypeScript and Svelte types
npm run check

# Watch mode
npm run check:watch
```

### Building

```bash
# Production build
npm run build

# Preview production build locally
npm run preview
```

---

## Testing

### Unit Tests

```bash
# Run all unit tests
npm run test:unit -- --run

# Watch mode
npm run test:unit

# Test specific file
npm run test:unit -- src/lib/server/db/orders.ts
```

Unit tests cover:
- RBAC permission checking
- Race condition handling (CAS updates)
- User admin workflows
- API route logic

### UI/Component Tests (Playwright)

```bash
# Run Playwright tests (requires dev server running on port 3000)
npm run test:ui-check

# Custom port (for worktree testing)
UI_CHECK_PORT=3001 npm run test:ui-check

# Cross-browser testing
npm run test:cross-browser

# Full E2E tests
npm run test:e2e
```

> **Note**: Playwright tests require a running dev server and `.env` credentials configured.

---

## Project Structure

```
src/
├── lib/
│   ├── components/          # Svelte components (tokenized design system)
│   ├── modules/
│   │   ├── rbac/           # Role-Based Access Control
│   │   ├── couchbase/      # Couchbase client initialization
│   │   └── encryption/     # Data encryption utilities
│   ├── server/
│   │   └── db/             # Database services
│   │       ├── users.ts              # User management
│   │       ├── inventory.ts          # Stock management
│   │       ├── orders.ts             # Order processing
│   │       ├── suppliers.ts          # Supplier & PO management
│   │       ├── pricing.ts            # Promotions & discounts
│   │       ├── pos.ts                # POS sessions & cash drawer
│   │       └── stock-takes.ts        # Inventory audits
│   └── store/              # Svelte stores (reactive state)
├── routes/
│   ├── api/
│   │   ├── admin/          # Admin API endpoints
│   │   ├── customer/       # Customer API endpoints
│   │   └── auth/           # Authentication endpoints
│   └── (authorized)/       # Protected pages
└── tests/                  # Test suites
    ├── *.spec.ts          # Unit tests (Vitest)
    └── *.spec.ts          # UI tests (Playwright)
```

---

## Core Features

### Phase 4 — Retail Operations
- **Inventory Management**: Multi-branch stock tracking, atomic CAS updates for race conditions
- **Order Management**: Order creation with automatic inventory reservation, status tracking
- **Supplier Management**: Purchase order workflow with approval tracking
- **Pricing Engine**: Promotions, discount codes, flexible discount types (percentage/fixed/BOGO)
- **POS Sessions**: Cash drawer management, session reconciliation, variance tracking
- **Stock Takes**: Inventory audits with variance reporting and escalation routing

### RBAC Features
- 4 core roles: Owner/Admin, Branch Manager, Cashier, Warehouse Staff
- Permission scoping: `own_branch` (single branch) vs `all` (multi-branch access)
- Atomic permission checking with caching
- Audit logging for sensitive operations

### Security
- JWT-based authentication with asymmetric ES256 signing
- Password hashing with bcrypt (12-round salt)
- AES-GCM encryption for sensitive data
- Rate limiting on auth endpoints (3 attempts / 15 minutes)
- Email blind indexing for user lookup without exposing plaintext

---

## Git Workflow

### Worktree-Based Development

```bash
# Create a new feature worktree
git worktree add .claude/worktrees/feature-name -b feature-name

# Work inside the worktree
cd .claude/worktrees/feature-name
npm run dev -- --port 3001

# Commit changes
git add . && git commit -m "feat: description"
git push origin feature-name

# Exit worktree
cd ../../.. && git worktree remove .claude/worktrees/feature-name

# Merge to master
git merge feature-name
```

### Branch Naming
- Features: `feature-<name>`
- Phases: `worktree-phase<N>-<topic>`
- Fixes: `fix-<issue>`

---

## API Endpoints

### Authentication
- `POST /api/login` — Login with email/password
- `POST /api/register` — User registration
- `POST /api/forgot-password` — Request password reset
- `POST /api/reset-password` — Reset password with token
- `POST /api/verify-email` — Verify email address

### Admin Operations
- `GET /api/admin/inventory/stock/list` — List stock
- `POST /api/admin/orders/create` — Create order
- `GET /api/admin/orders/list` — List orders
- `POST /api/admin/suppliers/create` — Add supplier
- `GET /api/admin/purchase-orders/list` — List POs
- `POST /api/admin/promotions/create` — Create promotion
- `POST /api/admin/pos/sessions/open` — Open POS session
- `POST /api/admin/stock-takes/create` — Create stock audit

### Customer Operations
- `GET /api/customer/orders/list` — View own orders
- `POST /api/customer/promotions/apply` — Apply promotion code

---

## Design System (Tokenized)

CSS custom properties for consistent theming:
- `--padding-*` (xs, sm, md, lg, xl)
- `--gap-*` (xs, sm, md, lg)
- `--font-size-*` (xs, sm, md, lg, xl, 2xl)
- `--min-height-*` (xs, sm, md, lg)
- `--radius-*` (sm, md, lg, full)
- `--color-*` (primary, danger, success, background, foreground)

All components use design tokens — no hardcoded values.

---

## Troubleshooting

### Dev Server Won't Start
- Check `.env` file is present and Couchbase credentials are correct
- Ensure port 3000 (or custom port) is available
- Run `npm run check` to identify type errors

### Tests Failing
- Unit tests: `npm run test:unit -- --run` for full output
- Playwright: Ensure dev server is running and `.env` is configured
- Check `.svelte-kit/` is writable (can delete if permission issues)

### Type Errors
- Run `npm run check:watch` to see errors in real-time
- Many pre-existing errors in component library (not Phase 4 code)
- Focus on new code in `src/lib/server/db/` — those should all type-check clean

---

## Contributing

### Code Standards
- TypeScript strict mode enabled
- Svelte components use reactive declarations (`$state`, `$effect`)
- Server code follows ActorContext pattern for permission checking
- Database queries use parameterized N1QL (no string interpolation)
- All services export safe field sanitizers for API responses

### Testing Before PR
```bash
npm run check          # Type-check
npm run build          # Build verification
npm run test:unit      # Unit tests (97 tests)
```

---

## Next Steps (Phase 5)

- Storefront customer UI (cart, checkout, account)
- Payment integration (Momo, ZaloPay, bank transfers)
- Click-and-collect + shipping integration (GHN/GHTK)
- PartyKit real-time sync (notifications, live dashboard)
- Multi-device experience (responsive, PWA, TV mode)

---

## License

Proprietary — Retail Management System
