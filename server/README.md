# ulpin-3d-live

Streaming geospatial feed for the ULPIN 3D workspace. The map and 3D view read
from this continuously; there is no request-on-demand path.

## Endpoints

| Route | Kind | Carries |
| --- | --- | --- |
| `GET /api/live/stream` | SSE | `hello`, `gnss`, `rover`, `imagery`, `tick` |
| `GET /api/live/snapshot` | JSON | Last frame of every source, for cold start |
| `GET /api/live/health` | JSON | Liveness, client count, synthetic flag |

## Feed status

Every frame is generated locally. No NTRIP caster, CORS network, or drone
downlink is connected, and `synthetic: true` is reported on `hello`, `snapshot`
and `health` so the UI can label it. Setting `LIVE_NTRIP_URL` flips the flag,
but no real transport is implemented behind it yet.

## Running

```
npm install
npm run dev
```

Listens on `5181` by default; override with `LIVE_PORT`. The Vite dev server
proxies `/api/live` here.
