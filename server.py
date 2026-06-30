#!/usr/bin/env python3
import json
import ipaddress
import re
import shutil
import subprocess
from datetime import datetime, timezone
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer


HOST = "127.0.0.1"
PORT = 8000


MAC_RE = re.compile(r"(?i)\b(?:[0-9a-f]{1,2}:){5}[0-9a-f]{1,2}\b")
IP_RE = re.compile(r"\b(?:\d{1,3}\.){3}\d{1,3}\b")


def normalize_mac(mac):
    if not mac:
        return None

    return ":".join(part.zfill(2) for part in mac.lower().split(":"))


def device_name(hostname, ip):
    if hostname and hostname not in {"?", "_gateway"}:
        return hostname

    return f"Device {ip}"


def is_device_address(ip, mac):
    try:
        address = ipaddress.ip_address(ip)
    except ValueError:
        return False

    if address.is_multicast or address.is_unspecified:
        return False

    if mac in {"ff:ff:ff:ff:ff:ff", "00:00:00:00:00:00"}:
        return False

    if mac and mac.startswith("01:00:5e:"):
        return False

    return True


def parse_ip_neigh(output):
    devices = []

    for line in output.splitlines():
        parts = line.split()
        if not parts:
            continue

        ip = parts[0]
        if not IP_RE.fullmatch(ip):
            continue

        mac = None
        if "lladdr" in parts:
            mac_index = parts.index("lladdr") + 1
            if mac_index < len(parts):
                mac = normalize_mac(parts[mac_index])

        interface = None
        if "dev" in parts:
            interface_index = parts.index("dev") + 1
            if interface_index < len(parts):
                interface = parts[interface_index]

        state = parts[-1].lower() if parts[-1].isalpha() else "unknown"
        hostname = "_gateway" if "_gateway" in parts else None
        if not is_device_address(ip, mac):
            continue

        devices.append(
            {
                "name": device_name(hostname, ip),
                "hostname": hostname,
                "ip": ip,
                "mac": mac,
                "interface": interface,
                "state": state,
                "type": "Unknown",
                "status": "known" if mac and state not in {"failed", "incomplete"} else "unknown",
            }
        )

    return devices


def parse_arp(output):
    devices = []

    for line in output.splitlines():
        ip_match = re.search(r"\((?P<ip>(?:\d{1,3}\.){3}\d{1,3})\)", line) or IP_RE.search(line)
        if not ip_match:
            continue

        ip = ip_match.group("ip") if "ip" in ip_match.groupdict() else ip_match.group(0)
        mac_match = MAC_RE.search(line)
        mac = normalize_mac(mac_match.group(0)) if mac_match else None
        hostname = line.split()[0] if line.split() else None
        if hostname == "?":
            hostname = None

        interface = None
        interface_match = re.search(r"\bon\s+([^\s]+)", line)
        if interface_match:
            interface = interface_match.group(1)

        state = "reachable" if mac else "incomplete"
        if not is_device_address(ip, mac):
            continue

        devices.append(
            {
                "name": device_name(hostname, ip),
                "hostname": hostname,
                "ip": ip,
                "mac": mac,
                "interface": interface,
                "state": state,
                "type": "Unknown",
                "status": "known" if mac else "unknown",
            }
        )

    return devices


def dedupe_devices(devices):
    deduped = {}

    for device in devices:
        key = device["mac"] or device["ip"]
        existing = deduped.get(key)
        if not existing:
            deduped[key] = device
            continue

        if not existing.get("mac") and device.get("mac"):
            deduped[key] = {**existing, **device}

    return sorted(deduped.values(), key=lambda device: tuple(int(part) for part in device["ip"].split(".")))


def run_discovery_command():
    commands = []
    if shutil.which("ip"):
        commands.append(("ip neigh", ["ip", "neigh"]))
    if shutil.which("arp"):
        commands.append(("arp -a", ["arp", "-a"]))

    errors = []
    for label, command in commands:
        try:
            result = subprocess.run(command, capture_output=True, text=True, timeout=4, check=False)
        except (OSError, subprocess.TimeoutExpired) as exc:
            errors.append(f"{label}: {exc}")
            continue

        if result.returncode != 0:
            errors.append(f"{label}: {result.stderr.strip() or 'command failed'}")
            continue

        devices = parse_ip_neigh(result.stdout) if command[0] == "ip" else parse_arp(result.stdout)
        if devices:
            return label, dedupe_devices(devices), None

        errors.append(f"{label}: no devices found")

    return None, [], "; ".join(errors) if errors else "Neither ip neigh nor arp -a is available"


class WifiControlHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == "/api/devices":
            self.send_devices()
            return

        super().do_GET()

    def send_devices(self):
        source, devices, error = run_discovery_command()
        payload = {
            "devices": devices,
            "source": source,
            "scannedAt": datetime.now(timezone.utc).isoformat(),
        }
        if error:
            payload["error"] = error

        body = json.dumps(payload, indent=2).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main():
    server = ThreadingHTTPServer((HOST, PORT), WifiControlHandler)
    print(f"WIFI Control serving http://{HOST}:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
