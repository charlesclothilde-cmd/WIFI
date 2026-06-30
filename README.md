# WIFI Control

A self-hosted Wi-Fi utility dashboard prototype.

Current modules:

- Wi-Fi QR code generator for WPA/WPA2/WPA3, WEP, open, and hidden networks
- Network device dashboard with known and unknown device states
- Speed logger with a compact local chart
- Intruder detector watchlist and acknowledgement flow
- Personal VPN status toggle
- Self-hosted service health panel

## Run

This is a static app. From this folder:

```bash
python3 -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

The QR generator uses `qrcodejs` from jsDelivr. The rest of the dashboard works without a build step.

## Roadmap

1. Replace mock device data with router, ARP, or `nmap` discovery.
2. Store speed checks in SQLite and schedule periodic tests.
3. Persist device fingerprints and alert on first-seen MAC addresses.
4. Generate WireGuard peer configs and QR onboarding cards.
5. Package as a Docker service for home server deployment.
