# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)
- **Mobile**: Expo (React Native) — Shams Tex
  - Icons: ALL icons use `lucide-react-native` via `components/Icon.tsx` — NO `@expo/vector-icons`
  - AppSettings includes: stats (clients/products/years), subcategories (Record<string, string[]>), TikTok in social
  - Product: has optional `subcategory?: string` field
  - Weight ordering: per-color kilo weight with individual +/- controls
  - products.tsx: "غير متوفر" special filter + subcategory chips
  - admin/settings.tsx: category reordering (↑/↓), stats editing, subcategory management

## Structure

```text
artifacts-monorepo/
├── artifacts/              # Deployable applications
│   ├── api-server/         # Express API server
│   ├── mockup-sandbox/     # Design mockup preview server
│   └── shamstex/           # Shams Tex Expo mobile app
├── lib/                    # Shared libraries
│   ├── api-spec/           # OpenAPI spec + Orval codegen config
│   ├── api-client-react/   # Generated React Query hooks
│   ├── api-zod/            # Generated Zod schemas from OpenAPI
│   └── db/                 # Drizzle ORM schema + DB connection
├── scripts/                # Utility scripts (single workspace package)
│   └── src/                # Individual .ts scripts
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── tsconfig.json
└── package.json
```

## Shams Tex Mobile App (`artifacts/shamstex`)

Expo React Native app for Shams Tex fabric company.

### Features
- Luxury black + gold design
- **Multi-language support (AR/EN)**: `lib/i18n.ts` provides `useTranslation()` hook; language toggle in profile; persisted via AsyncStorage; RTL-aware with `isRTL`, `textAlign`, `flexDir` helpers
- OTP phone login with Firebase Phone Authentication (real SMS verification); demo accounts use code 1234
- User roles: customer, merchant, employee, supervisor, admin
- Product catalog with fabric listings, colors, retail/wholesale pricing
- Cart with weight-based and piece-based ordering, payment method selection (cash, bank transfer, e-wallet, InstaPay)
- Order management with status tracking (pending → received → preparing → ready → delivered)
- Return/refund system: 3-stage flow (pending → returned → settled) with visual progress tracker; returns can be cancelled by admin or supervisor (with `cancel_returns` permission); customers can delete their own pending returns; cancelled returns allow re-submitting; returns appear as "استرجاع" filter in orders tab with cancelled state display
- Order editing: `edited: boolean` and `editedAt?: string` fields; shows yellow "معدّل" badge on OrderCard and order detail for staff
- Payment system: 4 methods (cash/bank transfer/e-wallet/InstaPay); e-wallet adds configurable fee %; modal shows payment details with copy-to-clipboard; admin configures payment numbers/accounts in settings
- Admin panel: products, prices, users, notifications, tabs management, payment settings
- Admin user management: delete customers/staff, promote to admin, primary admin (0000000001) protected from editing/deletion
- Push notifications system
- About/contact pages

### User Roles
- **Customer**: sees retail prices, can order
- **Merchant**: sees wholesale prices (approved by admin)
- **Employee**: limited admin access, permissions from admin
- **Supervisor**: broader admin access, can manage staff
- **Admin**: full control

### Permissions System
- Employee/Supervisor permissions stored in Firestore `customers` collection
- Permissions: `view_orders`, `edit_orders`, `view_products`, `edit_products`, `view_users`, `send_notifications`, `manage_staff`, `approve_upgrades`, `delete_orders`, `cancel_returns`, `manage_settings`
- Admin screens guarded by `useAdminGuard(permission)` hook — unauthorized access redirects back
- Permission changes sync in real-time to logged-in staff sessions

### Session Management
- Single-device enforcement: login from new device invalidates previous session via Firestore `sessions` collection
- Session token checked on app startup — mismatched token triggers auto-logout

### Order Editing by Customer
- Staff can mark an order as "editable" when an item is unavailable (button in order detail)
- Customer sees a yellow banner and "تعديل الطلب" button; opens cart pre-filled with order items
- Cart in edit mode shows "تصفح المنتجات لإضافة بديل" button to browse products
- On submit, `updateOrderItems` updates the order and clears editable flag
- Customer cannot edit orders otherwise
- Merchants see "اتصل بالجملة والتجار" call button in cart for piece orders

### Staff Order Locking
- When a staff member receives an order, `assignedTo` and `assignedToName` are set
- Other staff (except admin) cannot advance the order (buttons hidden, lock message shown)
- "استلمه: [name]" card displayed for all staff in order detail

### Real-time Sync
- Firestore listeners for: orders, customers, notifications, products
- Product order changes by admin reflect instantly for all users
- Permission/role changes sync to active sessions automatically
- `saveOrder` strips `undefined` values before Firestore write to avoid silent failures

### Demo accounts
- `0000000001` → Admin
- `0000000002` → Merchant  
- `0000000003` → Employee (default: view_orders, view_products)
- `0000000004` → Supervisor (default: view_orders, edit_orders, view_products, view_users, send_notifications, approve_upgrades)
- Any other number → Customer

### Key Files
- `app/_layout.tsx` — root layout with providers and splash screen
- `app/(tabs)/` — main tab screens (home, products, orders, contact)
- `app/product/[id].tsx` — product detail with color selection
- `app/cart.tsx` — shopping cart with try-catch checkout
- `app/order/[id].tsx` — order detail with status tracking
- `app/admin/` — admin management screens (all guarded by useAdminGuard)
- `context/AppContext.tsx` — global state with AsyncStorage persistence + Firestore listeners
- `hooks/useAdminGuard.ts` — permission guard hook for admin screens
- `hooks/useColors.ts` — design token hook
- `lib/firebase.ts` — Firestore operations + real-time subscriptions
- `lib/pushService.ts` — Expo push notifications
- `constants/colors.ts` — black/gold luxury design tokens

### Working Hours
- `WorkingDay` interface: `{ day, enabled, from, to }` stored in `settings.workingHours`
- Default: Sat–Thu 9:00–17:00 (Thu until 14:00), Friday off
- Admin can edit working hours in admin settings (toggle days, set from/to times)
- Orders cannot be moved from "pending" to "received" outside working hours (enforced in `updateOrderStatus`)

### Minimum Order Validation
- Weight orders: minimum 20 kg per item
- Piece orders: minimum 50 pieces per item
- Enforced at checkout with inline warnings in cart UI

### Notification Filtering
- `filterNotificationsForUser` (lib/notificationFilter.ts) controls visibility per role
- Untargeted notifications (no targetRole, no targetUserId) show to ALL roles
- Customer/merchant see: their own targeted + their role-targeted + untargeted ("all")
- Employee sees: own targeted + employee/staff targeted + untargeted
- Supervisor sees: own targeted + supervisor/staff + upgrade requests + untargeted
- Admin sees all (except other users' private notifications)

### Notification Linking
- All notifications include `linkedOrderId` (and `linkedReturnId` for returns)
- Tapping an order/return notification navigates directly to `/order/${linkedOrderId}`
- Return notifications shown in red styling
- All notifications auto-marked as read on page open

### Contact Info in Order Detail
- Contact card placed BELOW the editable/alternative products section
- Subtle muted text (11px, low opacity) — de-emphasized vs main action buttons
- Customer/pieces orders show sales phone (from settings contacts matching "مبيعات")
- Merchant orders show wholesale phone (matching "جملة" or "تاجر")

### Admin Users Page
- Search by name or phone number
- Sort by: date, name, order count
- Per-user stats: total orders, pending orders, total spent, last order date
- Inline confirmation dialog for role changes (customer ↔ merchant)
- VIP toggle, name editing, registration date display
- Staff tab: role switching (employee ↔ supervisor), permissions grid

### Pricing Logic
- Weight orders: price = weight × unit price (shown immediately); cart has +/- weight controls
- Piece orders: "Contact sales" message (no price shown)

### Favorites (المفضّلة)
- `User.favorites?: string[]` (product IDs) persisted on the customer Firestore doc; synced cross-device via the existing `subscribeCustomerByPhone` listener (must be listed in `syncUserWithRecords` change predicate)
- `favorites` / `isFavorite(id)` / `toggleFavorite(id)` on AppContext (mirrors the addAddress → updateRegisteredCustomer pattern)
- Heart toggle on ProductCard overlay + product detail header (GoldHeader rightElement); only shown when logged in
- Entry point: heart icon in home header → `app/favorites.tsx` (most-recently-added first; skips deleted products)

### Edit-Countdown Bar vs Toast
- `lib/editOrder.ts` exports `EDIT_BAR_CONTENT_H`, `selectActiveEditOrder`, `isEditWindowLive` shared by `EditCountdownBar.tsx` and `Toast.tsx`
- Toast shifts down by the bar height when an active edit window is live, so it isn't covered

## TypeScript & Composite Projects

Every package extends `tsconfig.base.json` which sets `composite: true`. The root `tsconfig.json` lists all packages as project references.

## Packages

### `artifacts/api-server` (`@workspace/api-server`)

Express 5 API server. Routes live in `src/routes/` and use `@workspace/api-zod` for request and response validation and `@workspace/db` for persistence.

### `lib/db` (`@workspace/db`)

Database layer using Drizzle ORM with PostgreSQL.

### `lib/api-spec` (`@workspace/api-spec`)

OpenAPI 3.1 spec and Orval codegen config.

### `lib/api-zod` (`@workspace/api-zod`)

Generated Zod schemas from the OpenAPI spec.

### `lib/api-client-react` (`@workspace/api-client-react`)

Generated React Query hooks and fetch client from the OpenAPI spec.

## Security Hardening (April 2026)

Added production-readiness improvements to artifacts/shamstex:
- `firestore.rules` — role-based Firestore access rules (DO NOT DEPLOY until real Firebase Phone Auth is wired; see header warning in file)
- `storage.rules` — image size/type limits, owner+staff read access for invoices/returns
- `firebase.json` + `firestore.indexes.json` — deployment config
- `lib/secureStorage.ts` — expo-secure-store wrapper (with web AsyncStorage fallback) for sensitive data
- `lib/validation.ts` — Egyptian phone regex (01[0125]xxxxxxxx) + amount/name validators
- `context/AppContext.tsx` — sessionToken now stored via secureStorage; added `persistUserSafe()` helper that strips token before AsyncStorage writes; one-time migration from old AsyncStorage tokens
- `app/auth/login.tsx` — uses `isValidPhone()` instead of length-only check
- Firebase config in `lib/firebase.ts` now reads from EXPO_PUBLIC_* env vars (with fallback defaults); see `.env.example`
- Removed old Firebase config snapshots from `attached_assets/`

⚠️ Still TODO before app store publication:
1. Replace fake client-side OTP (`generateWebOtp`/`verifyWebOtp` in lib/firebase.ts and `1234` demo path in login.tsx) with real Firebase Phone Auth (`signInWithPhoneNumber`). Requires Blaze plan and dev build (already using `@react-native-firebase/auth@^24`).
2. Convert phone storage to E.164 (+20...) in customers/orders/sessions doc IDs to match what Firebase Auth provides via `request.auth.token.phone_number` — OR adjust firestore.rules to extract local format.
3. Deploy firestore.rules and storage.rules via `firebase deploy --only firestore:rules,storage` after the above.

