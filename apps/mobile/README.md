# Nivas Staff Mobile App

React Native + Expo app for hotel staff. Built with Expo SDK 56, NativeWind, and cross-platform shared packages.

## Tech Stack

- **Expo SDK 56** — Latest stable Expo with Metro bundler
- **React Native 0.79** — Native rendering
- **NativeWind v4** — Tailwind CSS for React Native
- **Expo Router v3** — File-based routing
- **Zustand** — Lightweight state management
- **TanStack Query** — Server state caching
- **Lucide React Native** — Consistent iconography

## Quick Start

```bash
# From repo root
cd apps/mobile

# Install dependencies (Bun workspaces handles monorepo links)
bun install

# Start Expo dev server
bun run dev
```

## Running on Your Phone (with Localhost Backend)

Your phone cannot reach `localhost:3000` on your laptop. Use your laptop's **local network IP** instead.

### Step 1: Find Your Laptop's IP

**Windows:**
```powershell
ipconfig
# Look for "IPv4 Address" under your Wi-Fi adapter
```

**macOS/Linux:**
```bash
ifconfig | grep "inet "
```

Example: `192.168.1.42`

### Step 2: Update Mobile Env

```bash
cp .env.example .env
# Edit .env:
EXPO_PUBLIC_API_URL=http://192.168.1.42:3000
EXPO_PUBLIC_WS_URL=ws://192.168.1.42:3000
```

### Step 3: Update Backend CORS

Ensure your backend allows requests from your phone. In `services/backend/.env`:

```env
# Add your phone's origin (Expo dev server runs on port 8081)
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,http://192.168.1.42:3000,http://192.168.1.42:8081
```

Restart the backend Docker container:
```bash
docker compose restart backend
```

### Step 4: Run on Phone

**Option A: Expo Go (Fastest for testing)**
```bash
bun run dev
# Scan QR code with Expo Go app
```

**Option B: Development Build**
```bash
# Build and install development client
bunx expo run:android   # or :ios
```

### Important Notes

- **Same Wi-Fi required**: Phone and laptop must be on the same network
- **Firewall**: Allow port 3000 (backend) and 8081 (Expo) through Windows Firewall
- **Docker Desktop**: In Docker Desktop settings → Resources → Network, ensure "Expose daemon" is enabled if using VPN
- **No HTTPS**: Local development uses HTTP. For production, use ngrok or deploy backend.

## Production Readiness Checklist

Before building for production via EAS:

1. **Add custom assets**: Place your branding images in `assets/`:
   - `icon.png` — 1024×1024 app icon
   - `splash.png` — 1242×2438 splash screen
   - `adaptive-icon.png` — 1024×1024 Android adaptive icon
   - `favicon.png` — 512×512 web favicon
   - `notification-icon.png` — 96×96 notification icon (monochrome)
   Then uncomment the asset references in `app.json`.

2. **Set production API URLs** in `.env`:
   ```env
   EXPO_PUBLIC_API_URL=https://api.yourdomain.com
   EXPO_PUBLIC_WS_URL=wss://api.yourdomain.com
   ```

3. **Configure EAS**: Ensure `eas.json` profiles match your Expo account.

4. **Test on a physical device** before submitting to stores.

## EAS Build (Production)

```bash
# Preview build (internal distribution)
bunx eas build --profile preview --platform android

# Production build (Play Store / App Store)
bunx eas build --profile production --platform android
```

## Project Structure

```
app/
  (app)/           — Protected routes (dashboard, tabs)
  (auth)/          — Auth routes (login)
  _layout.tsx      — Root layout with providers
src/
  components/ui/   — NativeWind UI primitives
  components/layout/ — Screen wrappers
  hooks/           — useHaptics, useBiometric, useRefreshControl
  utils/           — API client, auth, push notifications, analytics
  stores/          — Zustand auth store
  types/           — TypeScript declarations
```

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `Network error` on phone | Use laptop IP, not localhost. Check firewall. |
| `CORS error` | Update `ALLOWED_ORIGINS` in backend `.env` |
| `Cannot resolve module` | Run `bun install` from repo root |
| White screen | Check `EXPO_PUBLIC_API_URL` is set correctly |
| Push notifications not working | Ensure `expo-notifications` plugin is in `app.json` |
