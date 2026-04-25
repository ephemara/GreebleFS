# GreebleFS Mobile & Tailscale Integration

GreebleFS extends beyond the desktop with a comprehensive mobile PWA and Tailscale-powered remote access system. This document details the mobile architecture, remote access capabilities, and cross-device experience.

## Mobile PWA Architecture

### Overview

GreebleFS includes a browser-safe mobile/PWA surface that provides file browsing and management capabilities on mobile devices. The mobile shell is a separate Vite entrypoint that builds to `dist-mobile/` for HTTP delivery.

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                    GreebleFS Desktop                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Tauri App  │  │   Axum HTTP │  │   Tailscale VPN     │  │
│  │  (Rust)     │  │   Server    │  │   (MagicDNS)        │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
│         │                │                     │              │
│         └────────────────┼─────────────────────┘              │
│                          │                                    │
│                   ┌──────▼──────┐                            │
│                   │   LAN/WAN   │                            │
│                   │   Network   │                            │
│                   └──────┬──────┘                            │
│                          │                                    │
│         ┌────────────────┼────────────────┐                  │
│         │                │                │                  │
│  ┌──────▼──────┐  ┌──────▼──────┐  ┌──────▼──────┐          │
│  │ Mobile PWA  │  │  Browser    │  │  Mobile     │          │
│  │ (dist-mobile)│  │  Access     │  │  (Tailscale)│          │
│  └─────────────┘  └─────────────┘  └─────────────┘          │
└─────────────────────────────────────────────────────────────┘
```

### Build Configuration

```typescript
// vite.mobile.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist-mobile',
    rollupOptions: {
      // Mobile-specific bundle configuration
    }
  },
  // No Tauri plugins - browser-safe only
});
```

### Mobile Entry Points

- `src-mobile/main.tsx`: Mobile bootstrap
- `src-mobile/App.tsx`: Mobile shell component
- `src-mobile/mobileApi.ts`: API client for desktop communication
- `src-mobile/mobileStore.ts`: Browser-safe Zustand store

### Mobile Shell Structure

The mobile shell is a four-tab application:

```
┌─────────────────────────────────────┐
│  ┌──────┬──────┬──────┬──────┐     │
│  │Explorer│Search│Transfers│Settings│ │
│  └──────┴──────┴──────┴──────┘     │
│                                     │
│  ┌─────────────────────────────┐   │
│  │                             │   │
│  │     Active Tab Content      │   │
│  │                             │   │
│  └─────────────────────────────┘   │
│                                     │
│  ┌─────────────────────────────┐   │
│  │   Draggable Bottom Sheet    │   │
│  │   (Preview, Actions, etc.)  │   │
│  └─────────────────────────────┘   │
└─────────────────────────────────────┘
```

### Tab 1: Explorer

- Virtualized file list using `@tanstack/react-virtual`
- Folder navigation with back/forward history
- Grid and list view modes
- Selection state management
- Context menu integration

### Tab 2: Search

- Access to desktop search index
- Name, content, and semantic search
- Result display with preview
- Quick actions on results

### Tab 3: Transfers

- Upload queue management
- Download progress tracking
- Transfer history
- Retry failed transfers

### Tab 4: Settings

- Theme selection
- Connection settings
- Storage management
- About and help

---

## Mobile API Endpoints

The desktop host exposes HTTP endpoints for mobile access.

### File Operations

```typescript
// GET /api/list
interface ListRequest {
  path: string;
  showHidden?: boolean;
  viewMode?: 'grid' | 'list';
}

interface ListResponse {
  entries: FileEntry[];
  path: string;
  hasMore: boolean;
}

// GET /api/preview
interface PreviewRequest {
  path: string;
  width?: number;
  height?: number;
}

interface PreviewResponse {
  contentType: string;
  data: string; // base64
}

// GET /api/thumbnail
interface ThumbnailRequest {
  path: string;
  size: number;
}

interface ThumbnailResponse {
  data: string; // base64
}

// GET /api/icon
interface IconRequest {
  path: string;
  size: number;
}

interface IconResponse {
  data: string; // base64
}
```

### Search

```typescript
// GET /api/search
interface SearchRequest {
  query: string;
  mode: 'name' | 'content' | 'semantic';
  limit?: number;
}

interface SearchResponse {
  results: SearchResult[];
  totalCount: number;
}
```

### Theme

```typescript
// GET /api/theme
interface ThemeResponse {
  appearance: ResolvedOverlayAppearance;
  icons: IconThemeData;
  fonts: FontData[];
}
```

### Upload/Download

```typescript
// POST /api/upload
interface UploadRequest {
  path: string;
  file: File;
}

interface UploadResponse {
  success: boolean;
  path: string;
}

// GET /api/download
interface DownloadRequest {
  path: string;
}

// Streaming response with progress
```

---

## Service Worker

The mobile PWA uses Workbox for offline capability.

```typescript
// src-mobile/sw.ts
import { precache, route } from 'workbox-routing';
import { CacheFirst, NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';

precache([
  '/index.html',
  '/manifest.json',
  '/assets/app.js',
  '/assets/app.css',
]);

// API requests - network first with cache fallback
route(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-cache',
    plugins: [{
      cacheWillUpdate: async ({ response }) => {
        if (response.status === 200) {
          return response;
        }
        return null; // Don't cache non-200 responses
      }
    }]
  })
);

// Static assets - cache first
route(
  ({ request }) => request.destination === 'image',
  new CacheFirst({
    cacheName: 'images',
  })
);
```

### Caching Strategy

| Resource Type | Strategy | Cache Name |
|--------------|----------|------------|
| API responses | Network First | api-cache |
| App shell | Precache | - |
| Images | Cache First | images |
| Fonts | Stale While Revalidate | fonts |
| Thumbnails | Cache First | thumbnails |

---

## Tailscale Integration

### Overview

Tailscale provides secure, peer-to-peer networking for remote mobile access without port forwarding.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      Tailscale Network                       │
│                                                             │
│  ┌─────────────┐         ┌─────────────┐                   │
│  │   Desktop   │◄───────►│    Mobile   │                   │
│  │  (Tailnet)  │  WireGuard│  (Tailnet) │                   │
│  └──────┬──────┘         └──────┬──────┘                   │
│         │                       │                           │
│         │    MagicDNS           │                           │
│         │    (desktop.local)    │                           │
│         └───────────────────────┘                           │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              Tailnet Admin Console                   │   │
│  │  • Device management                                 │   │
│  │  • Access controls                                   │   │
│  │  • Network settings                                  │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

### Setup

1. **Install Tailscale** on desktop and mobile
2. **Authenticate** both devices to the same Tailnet
3. **Enable MagicDNS** for automatic name resolution
4. **Configure ACLs** for device access

### Mobile Access URL

Once connected, mobile devices access the desktop at:

```
http://desktop.local:8080
```

Or via Tailscale IP:

```
http://100.x.x.x:8080
```

### Configuration

```typescript
// Mobile store configuration
interface TailscaleConfig {
  enabled: boolean;
  deviceName: string;
  tailnet: string;
  magicDNS: boolean;
  accessControl: 'all' | 'trusted' | 'none';
}
```

### Security

- **WireGuard encryption** for all traffic
- **MagicDNS** for secure name resolution
- **ACL controls** for device access
- **No port forwarding** required
- **Peer-to-peer** connection when possible

---

## LAN Share

### mDNS Discovery

The desktop host advertises itself on the local network.

```typescript
// mDNS service advertisement
const serviceInfo = {
  name: 'GreebleFS',
  type: '_greeblefs._tcp',
  port: 8080,
  host: 'desktop.local',
  attributes: {
    version: '1.0.0',
    features: 'explorer,search,transfers'
  }
};
```

### Direct Streaming

For media files, mobile clients can stream directly:

```typescript
// Range-based streaming
async function streamMedia(path: string, range: string): Promise<Response> {
  const file = await openFile(path);
  const [start, end] = parseRange(range);
  const chunk = await file.read(start, end);
  
  return new Response(chunk, {
    status: 206, // Partial Content
    headers: {
      'Content-Type': getMimeType(path),
      'Content-Range': `bytes ${start}-${end}/${file.size}`,
      'Content-Length': chunk.length.toString()
    }
  });
}
```

---

## Mobile Push Notifications

### VAPID-Backed Push

GreebleFS uses VAPID (Voluntary Application Server Identification) for push notifications.

```typescript
// Push notification setup
interface PushConfig {
  vapidPublicKey: string;
  vapidPrivateKey: string;
  subject: 'mailto:admin@example.com' | 'https://example.com';
}

// Subscribe to push
async function subscribeToPush(): Promise<PushSubscription> {
  const registration = await navigator.serviceWorker.ready;
  return registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: vapidPublicKey
  });
}
```

### Notification Types

| Type | Description | Priority |
|------|-------------|----------|
| Download Complete | File download finished | Normal |
| Upload Complete | File upload finished | Normal |
| Transfer Error | Transfer failed | High |
| Device Connected | Mobile device paired | Low |
| Storage Alert | Low disk space | High |

### Notification Display

```typescript
// Show notification
function showNotification(
  title: string,
  options: NotificationOptions
): void {
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: options.body,
      icon: '/icons/notification.png',
      tag: options.tag,
      data: options.data,
      actions: options.actions
    });
  }
}
```

---

## Mobile Preview System

### Preview Overlay

Mobile provides a bottom sheet preview for files:

```typescript
// Preview bottom sheet
interface PreviewSheet {
  isOpen: boolean;
  file: FileEntry | null;
  mode: 'preview' | 'edit' | 'actions';
  
  open(file: FileEntry): void;
  close(): void;
  setMode(mode: 'preview' | 'edit' | 'actions'): void;
}
```

### Preview Types

| File Type | Preview Method |
|-----------|---------------|
| Images | Inline display with zoom/pan |
| Video | Video player with controls |
| Audio | Audio player with waveform |
| PDF | PDF.js rendering |
| Text | Syntax-highlighted view |
| Code | Monaco editor (lightweight) |
| Archives | File list extraction |

### Gesture Support

- **Tap**: Open preview
- **Swipe Down**: Dismiss preview
- **Swipe Left/Right**: Navigate files
- **Pinch**: Zoom images
- **Long Press**: Context menu

---

## Upload/Download Queue

### Upload Queue

```typescript
interface UploadQueue {
  items: UploadItem[];
  activeCount: number;
  maxConcurrent: number;
  
  add(path: string, file: File): void;
  remove(id: string): void;
  retry(id: string): void;
  clear(): void;
}

interface UploadItem {
  id: string;
  path: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'complete' | 'error';
  error?: string;
}
```

### Download Queue

```typescript
interface DownloadQueue {
  items: DownloadItem[];
  activeCount: number;
  maxConcurrent: number;
  
  add(path: string): void;
  remove(id: string): void;
  pause(id: string): void;
  resume(id: string): void;
  retry(id: string): void;
  clear(): void;
}

interface DownloadItem {
  id: string;
  path: string;
  progress: number;
  status: 'pending' | 'downloading' | 'complete' | 'error' | 'paused';
  error?: string;
  localPath?: string;
}
```

---

## Performance Optimization

### Virtualization

Large file lists use virtualization:

```typescript
// @tanstack/react-virtual
const rowVirtualizer = useVirtualizer({
  count: files.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 48,
  overscan: 5,
});
```

### Image Optimization

- Request appropriate sizes for thumbnails
- WebP format for smaller sizes
- Lazy loading for off-screen images
- Caching with proper cache headers

### Network Optimization

- Compression for API responses
- Chunked transfers for large files
- Connection keep-alive
- Request batching

---

## Security Considerations

### Authentication

- Tailscale authentication for network access
- Optional app-level authentication
- Session timeout management
- Secure token storage

### Authorization

- ACL-based access control
- Path-based restrictions
- Operation permissions
- Audit logging

### Data Protection

- TLS for all HTTP communication
- Encrypted local storage
- Secure credential storage
- Privacy-first design

---

## Cross-Device Experience

### Seamless Transitions

- **Continue on Mobile**: Start task on desktop, continue on mobile
- **Sync State**: Preferences and settings sync across devices
- **Transfer Queue**: Start transfer on desktop, monitor on mobile

### Feature Parity

| Feature | Desktop | Mobile |
|---------|---------|--------|
| File browsing | ✓ | ✓ |
| Search | ✓ | ✓ |
| Preview | ✓ | ✓ |
| Edit | ✓ | Limited |
| Upload/Download | ✓ | ✓ |
| Terminal | ✓ | ✗ |
| Plugins | ✓ | ✗ |
| Themes | ✓ | ✓ |
| Settings | ✓ | ✓ |

---

## Summary

GreebleFS mobile and Tailscale integration provides:

- **Full PWA Support**: Browser-safe mobile application
- **Four-Tab Shell**: Explorer, Search, Transfers, Settings
- **HTTP API**: Desktop host exposes REST endpoints
- **Service Worker**: Offline capability with Workbox
- **Tailscale VPN**: Secure remote access without port forwarding
- **mDNS Discovery**: Automatic LAN device discovery
- **Push Notifications**: VAPID-backed alerts
- **Gesture Support**: Touch-optimized interactions
- **Queue Management**: Upload/download with progress tracking
- **Cross-Device Sync**: Seamless experience across devices

The mobile system extends GreebleFS beyond the desktop, enabling file management from any device on the network.