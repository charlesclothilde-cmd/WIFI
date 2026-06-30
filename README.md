# WIFI Control

A self-hosted Wi-Fi utility dashboard prototype.

Current modules:

- Wi-Fi QR code generator for WPA/WPA2/WPA3, WEP, open, and hidden networks
- Network device dashboard backed by local `arp -a` or `ip neigh` discovery
- Speed logger with a compact local chart
- Intruder detector watchlist and acknowledgement flow
- Personal VPN status toggle
- Self-hosted service health panel

## Run

From this folder:

```bash
python3 server.py
```

Then open:

```text
http://localhost:8000
```

The backend exposes `GET /api/devices`, which reads the local neighbour table with `ip neigh` when available and falls back to `arp -a`.

The QR generator uses `qrcodejs` from jsDelivr. The rest of the dashboard works without a build step.

## Roadmap

1. Persist device fingerprints and alert on first-seen MAC addresses.
2. Store speed checks in SQLite and schedule periodic tests.
3. Generate WireGuard peer configs and QR onboarding cards.
4. Package as a Docker service for home server deployment.
