# Phase 5 Task Breakdown — Omnichannel E-commerce + Realtime

Vertical slicing: mỗi feature đi kèm Service + API routes + UI + tests trong 1 task

---

## Task #33: Shopping Cart (Full Stack)

**Scope**: Cart CRUD operations, item management, promotion application

**Implementation**:
1. **CartService** (`src/lib/server/db/carts.ts`)
   - `listUserCarts(actor)` — list cart history
   - `getCart(actor, cartId)` — get cart
   - `createCart(actor, branchId)` — new cart
   - `addItem(actor, cartId, variantId, quantity)` — add to cart + reserve stock
   - `removeItem(actor, cartId, variantId)` — remove + release stock
   - `updateQuantity(actor, cartId, variantId, quantity)` — CAS atomic update
   - `applyPromotion(actor, cartId, promotionCode)` — validate + calculate discount
   - `clearCart(actor, cartId)` — empty cart + release all inventory

2. **API Routes**
   - `POST /api/customer/carts/create` — create cart
   - `GET /api/customer/carts/{cartId}` — view cart
   - `POST /api/customer/carts/{cartId}/items/add` — add item
   - `DELETE /api/customer/carts/{cartId}/items/{variantId}` — remove item
   - `PATCH /api/customer/carts/{cartId}/items/{variantId}/quantity` — update qty
   - `POST /api/customer/carts/{cartId}/promotion/apply` — apply code
   - `DELETE /api/customer/carts/{cartId}` — clear cart

3. **Storefront UI** (`src/routes/storefront/cart`)
   - `/storefront/cart` page — display cart items
   - Components: CartItem, CartSummary, PromoInput, Checkout CTA
   - Actions: update qty, remove item, apply promo, navigate checkout

4. **Tests**
   - Unit: CartService methods (stock reserve/release, promotion calc)
   - Integration: API routes with auth
   - E2E: Add item → view cart → apply promo → verify total

---

## Task #34: Checkout Flow (Full Stack)

**Scope**: Checkout form, address validation, payment method selection, order conversion

**Implementation**:
1. **CheckoutService** (`src/lib/server/db/checkout.ts`)
   - `createCheckout(actor, cartId, branchId)` — init checkout from cart
   - `getCheckout(actor, checkoutId)` — view checkout
   - `updateShippingAddress(actor, checkoutId, address)` — validate & save
   - `updateBillingAddress(actor, checkoutId, address)` — optional
   - `selectShippingMethod(actor, checkoutId, method)` — pickup|ghn|ghtk|ahamove
   - `selectPaymentMethod(actor, checkoutId, method)` — cash|bank_pos|momo|zalopay|bank_transfer|cod
   - `convertToOrder(actor, checkoutId)` — create order from checkout
   - `abandonCheckout(actor, checkoutId)` — release stock + mark abandoned

2. **API Routes**
   - `POST /api/customer/checkouts/create` — from cart
   - `GET /api/customer/checkouts/{checkoutId}` — view
   - `PUT /api/customer/checkouts/{checkoutId}/shipping-address` — update
   - `PUT /api/customer/checkouts/{checkoutId}/billing-address` — update
   - `POST /api/customer/checkouts/{checkoutId}/shipping-method` — select
   - `POST /api/customer/checkouts/{checkoutId}/payment-method` — select
   - `POST /api/customer/checkouts/{checkoutId}/complete` — convert to order

3. **Storefront UI** (`src/routes/storefront/checkout`)
   - `/storefront/checkout/{checkoutId}` multi-step form
   - Steps: ShippingAddress → BillingAddress → ShippingMethod → PaymentMethod → Review → Confirm
   - Components: AddressForm, MethodSelector, OrderSummary
   - Validation: postal code format, phone format, required fields

4. **Tests**
   - Unit: CheckoutService conversions, validations
   - Integration: Address update, method selection, order creation
   - E2E: Full checkout flow → order created

---

## Task #35: Payment Integration (Full Stack — Backend + UI + Webhooks)

**Scope**: Payment method handlers, webhook receivers, status tracking, payment page

**Implementation**:
1. **PaymentService** (`src/lib/server/db/payment-handlers.ts`)
   - `initiateMomoPayment(orderId, amount, redirectUrl)` — call Momo API
   - `initiateZaloPayPayment(orderId, amount, redirectUrl)` — call ZaloPay API
   - `recordBankTransfer(orderId, transferAmount, refNo)` — manual entry + verify
   - `recordCashPayment(orderId, amount, paymentMethod)` — POS record
   - `recordLoyaltyPayment(orderId, pointsUsed, amount)` — point redeem

2. **Webhook Handlers** (`src/routes/api/webhooks`)
   - `POST /api/webhooks/momo/notify` — Momo payment callback
   - `POST /api/webhooks/zalopay/notify` — ZaloPay payment callback
   - Verify signature → update order payment status → emit realtime event

3. **API Routes** (customer)
   - `POST /api/customer/orders/{orderId}/payment/momo` — init Momo redirect
   - `POST /api/customer/orders/{orderId}/payment/zalopay` — init ZaloPay redirect
   - `POST /api/customer/orders/{orderId}/payment/manual` — record manual transfer
   - `GET /api/customer/orders/{orderId}/payment/status` — check status

4. **Storefront UI** (`src/routes/storefront/payment`)
   - `/storefront/payment/{orderId}` page — payment method selector
   - Components: PaymentMethodCard (cash/card/momo/zalopay/transfer), PaymentStatus (pending/completed/failed)
   - Actions: click to initiate payment, handle redirect back from provider, show status

5. **Tests**
   - Unit: Payment signature verification, amount calculation
   - Integration: Webhook processing, order status update
   - E2E: Select payment method → redirect → callback → status update
   - Mock: Mock Momo/ZaloPay API responses for testing

---

## Task #36: Shipment Integration (Full Stack — GHN/GHTK + Tracking UI)

**Scope**: Shipping provider APIs, tracking updates, status webhooks, shipment management UI

**Implementation**:
1. **ShipmentService** (`src/lib/server/db/shipments.ts`)
   - `createShipment(orderId, provider, address, items)` — call provider API
   - `getShipment(actor, shipmentId)` — fetch tracking
   - `updateTrackingStatus(shipmentId, status, notes)` — periodic poll | webhook
   - `cancelShipment(shipmentId)` — cancel with provider
   - `trackPackage(trackingNumber, provider)` — lookup tracking

2. **Provider Abstractions** (`src/lib/server/shipping`)
   - `ShippingProvider` interface (createOrder, getTracking, cancelOrder)
   - `GHNProvider` — calls GHN API
   - `GHKTProvider` — calls GHTK API
   - `MockProvider` — for development/testing

3. **API Routes** (admin + customer)
   - `POST /api/admin/shipments/create` — manual create
   - `GET /api/customer/orders/{orderId}/shipment/tracking` — view tracking
   - `GET /api/customer/shipments/{trackingNumber}/track` — public tracking link
   - Webhook: `POST /api/webhooks/shipping/update` — provider status callback

4. **Admin UI** (`src/routes/(authorized)/admin/shipments`)
   - `/admin/shipments/list` — **Table**: shipments with filter by status/provider, paginate
   - `/admin/shipments/{shipmentId}` — detail: tracking number, provider, current status, history, cancel action

5. **Storefront UI** (`src/routes/storefront/tracking`)
   - `/storefront/tracking/{trackingNumber}` — public tracking page (no login required)
   - Components: TrackingTimeline (status history with timestamps), TrackingMap (if provider supports)
   - Real-time updates via websocket

6. **Tests**
   - Unit: Provider interface mocking
   - Integration: Create shipment → poll tracking
   - E2E: Order → shipment creation → tracking updates (public + admin)

---

## Task #37: PartyKit Realtime Sync (Backend Only — No UI)

**Scope**: Room subscriptions, message broadcasting, sync state management

**Note**: This is **backend infrastructure task** — no UI in this task. Client-side realtime integration happens in #33-36 & #39 (where they subscribe to rooms).

**Implementation**:
1. **PartyKit Setup** (`src/lib/server/partykit`)
   - Server-side: Define room strategy, message types, sync state
   - Rooms: `branch:{branchId}` (team notifications), `role:owner` (broadcast to owners)
   - Rooms: `cart:{userId}` (cart changes), `order:{orderId}` (order updates)

2. **Realtime Services**
   - `BroadcastService` — emit events (order created, payment received, shipment updated)
   - `SyncStateService` — manage partykit_sync_state collection (last sync, unack count)
   - `NotificationDispatcher` — route notifications to rooms

3. **Client-side** (`src/lib/client/realtime`)
   - WebSocket connector to PartyKit (reusable, used by multiple pages)
   - Room subscription/unsubscription
   - Offline queue for messages
   - Reconnect with exponential backoff

4. **Integration Points** (called FROM other tasks)
   - CartService: emit cart update event
   - CheckoutService: emit checkout progress
   - PaymentService: emit payment status change
   - ShipmentService: emit tracking update
   - OrderService: emit order status change

5. **Tests**
   - Unit: Message serialization, room routing logic
   - Integration: Publish event → room receives
   - Mock PartyKit server for testing

---

## Task #38: Storefront Foundation (Public Pages + Product Catalog)

**Scope**: Storefront layout, product browsing, search, category filtering

**Implementation**:
1. **Public Pages** (`src/routes/storefront`)
   - `/storefront` — home page with featured products
   - `/storefront/products` — browse all products, filtering by category/brand
   - `/storefront/products/{variantId}` — product detail with images, reviews
   - `/storefront/search?q=...` — N1QL full-text search
   - `/storefront/account` — customer profile, order history

2. **Components**
   - ProductCard, ProductGrid, ProductFilter
   - SearchBar, CategoryNav, BrandNav
   - PriceRangeSlider

3. **API Routes** (public)
   - `GET /api/public/products/list` — paginated list
   - `GET /api/public/products/{variantId}` — detail
   - `GET /api/public/products/search?q=...` — search
   - `GET /api/public/categories` — list categories
   - `GET /api/public/brands` — list brands

4. **Image Handling**
   - `ImageStorageProvider` interface abstraction
   - Route: `GET /api/images/{imageId}` — server streams from Adobe/storage
   - Client: lazy load images, placeholder

5. **Tests**
   - Unit: Search/filter query building
   - Integration: Fetch products, apply filters
   - E2E: Browse categories → search → view product detail

---

## Task #39: Admin Realtime Dashboard (Full Stack — Aggregated Live Views)

**Scope**: Live dashboard with websocket sync, aggregating Phase 4 + Phase 5 data, order/inventory/payment updates

**Implementation**:
1. **Dashboard Page** (`src/routes/(authorized)/admin/dashboard`)
   - Live order list (new orders appear in real-time) — from #33-34
   - Live inventory summary (stock changes update) — from Phase 4 #27
   - Payment status indicators (pending → completed) — from #35
   - Shipment tracking (in-transit → delivered) — from #36
   - **Phase 4 refactored data** (after Priority 1 component refactor):
     - Promotions summary (active promos, usage count) — Phase 4 #30
     - POS session summary (open sessions, total cash) — Phase 4 #31
     - Stock takes in progress (variance alerts, pending approvals) — Phase 4 #32

2. **Components**
   - LiveOrderFeed — subscribe to `branch:{branchId}` room for order updates
   - LiveInventorySummary — subscribe to inventory changes
   - PaymentPanel — show pending/completed by method
   - ShipmentTracker — live status updates with timeline
   - PromotionWidget — active promos, performance
   - POSWidget — current sessions, total handled
   - StockTakeWidget — pending audits, variance alerts

3. **Realtime Subscriptions**
   - Subscribe to `branch:{branchId}` room for team updates
   - Owner subscribes to `role:owner` for all branches
   - Auto-unsubscribe on page leave
   - Receives events from #33-36 via PartyKit (#37)

4. **API Enhancements**
   - Admin: `GET /api/admin/dashboard/summary` — live data export (orders, inventory, payments, shipments, promos, POS, stock takes)
   - Admin: WebSocket subscription management
   - Real-time event aggregation across all features

5. **Tests**
   - Integration: Subscribe to room → receive updates
   - E2E: Create order → see on dashboard in real-time
   - E2E: Create promotion → see in widget
   - E2E: Open POS session → see in POS widget
   - E2E: Start stock take → see in alerts

---

## Task #40: Unified Order Fulfillment (POS + Online Orders, Same System)

**Scope**: Merge POS orders (cash/card) + Online orders (checkout) into unified flow

**Implementation**:
1. **Order Consolidation**
   - Extend `orders` collection: add `channel` field ('pos' | 'online')
   - OrderService: handle both POS + online order creation
   - Status flow: same for both (pending → paid → fulfilled → returned)

2. **Fulfillment Features**
   - Admin view: all orders (POS + online) in single list
   - Filter by channel, branch, status, date range
   - Pick/pack/ship workflow (same for both channels)
   - Auto-assignment to warehouse staff based on branch

3. **API Routes**
   - `GET /api/admin/orders/list?channel=all|pos|online` — unified list
   - `POST /api/admin/orders/{orderId}/pick` — mark picked
   - `POST /api/admin/orders/{orderId}/pack` — mark packed
   - `POST /api/admin/orders/{orderId}/ship` — attach shipment

4. **Tests**
   - Integration: POS order + online order in same workflow
   - E2E: Create online order → fulfill → shipment → delivery

---

## Summary

| Task | Feature | Services | API Routes | UI Pages | Est. Lines |
|------|---------|----------|-----------|----------|-----------|
| #33 | Cart | CartService | 7 routes | 1 page | 1.5k |
| #34 | Checkout | CheckoutService | 7 routes | 1 page (multi-step) | 1.5k |
| #35 | Payments | PaymentService | 4 routes | webhooks | 1k |
| #36 | Shipments | ShipmentService, Providers | 4 routes | 1 page | 1.5k |
| #37 | Realtime | BroadcastService, SyncState | websocket | — | 1k |
| #38 | Storefront | ProductService | 5 routes | 5 pages | 2k |
| #39 | Dashboard | DashboardService | 1 route | 1 page | 1k |
| #40 | Fulfillment | OrderService (merge) | 3 routes | update admin | 0.5k |

**Total Phase 5: ~10k lines code + comprehensive tests**

Estimate: 8-12 work days (1-2 weeks depending on testing depth)
