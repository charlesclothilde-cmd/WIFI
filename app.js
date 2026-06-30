let devices = [
  { name: "MacBook Pro", ip: "192.168.1.22", type: "Laptop", status: "known" },
  { name: "Pixel 9", ip: "192.168.1.34", type: "Phone", status: "known" },
  { name: "Living Room TV", ip: "192.168.1.41", type: "Media", status: "known" },
  { name: "Office Printer", ip: "192.168.1.52", type: "Printer", status: "known" },
  { name: "NAS", ip: "192.168.1.10", type: "Server", status: "known" },
  { name: "ESP-32-CAM", ip: "192.168.1.78", type: "Unknown", status: "unknown" }
];

const speedLog = [338, 391, 364, 420, 417, 446, 402, 431, 417];
const events = [
  "22:41 · ESP-32-CAM appeared on the guest network",
  "21:18 · NAS backup completed",
  "20:02 · Printer rejoined after DHCP renewal"
];

const qrCodeEl = document.querySelector("#qrCode");
const form = document.querySelector("#wifiForm");
const ssidEl = document.querySelector("#ssid");
const passwordEl = document.querySelector("#password");
const securityEl = document.querySelector("#security");
const hiddenEl = document.querySelector("#hidden");
const cardSsid = document.querySelector("#cardSsid");
const cardMeta = document.querySelector("#cardMeta");
const scanButton = document.querySelector("#scanDevices");
const scanStatus = document.querySelector("#scanStatus");

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => {
    const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
    return entities[char];
  });
}

function escapeWifi(value) {
  return value.replace(/([\\;,:"])/g, "\\$1");
}

function wifiPayload() {
  const auth = securityEl.value;
  const ssid = escapeWifi(ssidEl.value.trim());
  const password = auth === "nopass" ? "" : `P:${escapeWifi(passwordEl.value)};`;
  const hidden = hiddenEl.checked ? "H:true;" : "";
  return `WIFI:T:${auth};S:${ssid};${password}${hidden};`;
}

function generateQr() {
  const payload = wifiPayload();
  qrCodeEl.innerHTML = "";

  if (window.QRCode) {
    new QRCode(qrCodeEl, {
      text: payload,
      width: 256,
      height: 256,
      correctLevel: QRCode.CorrectLevel.M
    });
  } else {
    const fallback = document.createElement("div");
    fallback.className = "qr-fallback";
    fallback.textContent = "QR library unavailable. Copy the Wi-Fi payload instead.";
    qrCodeEl.appendChild(fallback);
  }

  cardSsid.textContent = ssidEl.value.trim() || "Unnamed network";
  cardMeta.textContent = `${securityEl.options[securityEl.selectedIndex].text} · ${hiddenEl.checked ? "hidden" : "visible"}`;
}

function renderDevices() {
  const grid = document.querySelector("#deviceGrid");
  grid.innerHTML = devices.length
    ? devices
    .map((device) => {
      const badgeClass = device.status === "unknown" ? "badge warn" : "badge";
      const meta = [device.type, device.mac, device.interface, device.state].filter(Boolean).join(" · ");
      return `
        <article class="device-card">
          <header>
            <strong>${escapeHtml(device.name)}</strong>
            <span class="${badgeClass}">${escapeHtml(device.status)}</span>
          </header>
          <small>${escapeHtml(meta || "Unknown")}</small>
          <span>${escapeHtml(device.ip)}</span>
        </article>
      `;
    })
    .join("")
    : `<p class="empty-state">No devices found yet. Run a scan from the local backend.</p>`;

  document.querySelector("#knownCount").textContent = devices.filter((device) => device.status === "known").length;
  document.querySelector("#alertCount").textContent = devices.filter((device) => device.status === "unknown").length;
}

function updateSecuritySummary() {
  const unknownDevices = devices.filter((device) => device.status === "unknown");
  const firstUnknown = unknownDevices[0];
  document.querySelector("#securityState").textContent = unknownDevices.length
    ? `${unknownDevices.length} unknown ${unknownDevices.length === 1 ? "device" : "devices"}`
    : "No unknown devices";
  document.querySelector("#securityDetail").textContent = firstUnknown
    ? `${firstUnknown.name} is visible at ${firstUnknown.ip}.`
    : "All visible devices are on the known list.";
}

function formatScanTime(value) {
  if (!value) return "Never scanned";

  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  }).format(new Date(value));
}

async function scanDevices() {
  scanButton.disabled = true;
  scanStatus.textContent = "Scanning local neighbour table...";

  try {
    const response = await fetch("/api/devices", { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    devices = Array.isArray(payload.devices) ? payload.devices : [];
    renderDevices();
    updateSecuritySummary();

    scanStatus.textContent = payload.error
      ? `Scan completed with warnings: ${payload.error}`
      : `Last scan ${formatScanTime(payload.scannedAt)} from ${payload.source || "local discovery"}`;
  } catch (error) {
    scanStatus.textContent = "Device API unavailable. Start the backend with python3 server.py.";
  } finally {
    scanButton.disabled = false;
  }
}

function renderSpeed() {
  const latest = speedLog.at(-1);
  document.querySelector("#downSpeed").textContent = latest;
  document.querySelector("#upSpeed").textContent = Math.round(latest / 8.1);
  document.querySelector("#pingSpeed").textContent = Math.max(7, Math.round(18 - latest / 45));

  const max = Math.max(...speedLog);
  document.querySelector("#speedChart").innerHTML = speedLog
    .map((value) => `<div class="bar" style="height:${Math.max(16, (value / max) * 100)}%" title="${value} Mbps"></div>`)
    .join("");
}

function renderEvents() {
  document.querySelector("#eventList").innerHTML = events.map((event) => `<li>${event}</li>`).join("");
}

function downloadQr() {
  const canvas = qrCodeEl.querySelector("canvas");
  const image = qrCodeEl.querySelector("img");
  const link = document.createElement("a");
  link.download = `${ssidEl.value.trim() || "wifi"}-qr.png`;

  if (canvas) {
    link.href = canvas.toDataURL("image/png");
  } else if (image) {
    link.href = image.src;
  } else {
    return;
  }

  link.click();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  generateQr();
});

document.querySelector("#downloadQr").addEventListener("click", downloadQr);

document.querySelector("#copyPayload").addEventListener("click", async () => {
  await navigator.clipboard.writeText(wifiPayload());
});

scanButton.addEventListener("click", scanDevices);

document.querySelector("#logSpeed").addEventListener("click", () => {
  speedLog.push(Math.round(360 + Math.random() * 110));
  if (speedLog.length > 12) speedLog.shift();
  renderSpeed();
  document.querySelector("#logCount").textContent = Number(document.querySelector("#logCount").textContent) + 1;
});

document.querySelector("#ackAlerts").addEventListener("click", () => {
  devices.forEach((device) => {
    if (device.status === "unknown") device.status = "known";
  });
  document.querySelector("#securityState").textContent = "No unknown devices";
  document.querySelector("#securityDetail").textContent = "All visible devices are on the known list.";
  renderDevices();
});

document.querySelector("#vpnToggle").addEventListener("change", (event) => {
  document.querySelector("#vpnState").textContent = event.target.checked ? "WireGuard profile ready" : "VPN disabled";
  document.querySelector("#vpnDetail").textContent = event.target.checked
    ? "Endpoint 10.8.0.1 · 2 peers configured"
    : "Remote tunnel is stopped for this dashboard.";
});

document.querySelector("#refreshHealth").addEventListener("click", () => {
  document.querySelector("#logCount").textContent = Number(document.querySelector("#logCount").textContent) + 1;
});

["input", "change"].forEach((eventName) => {
  [ssidEl, passwordEl, securityEl, hiddenEl].forEach((element) => element.addEventListener(eventName, generateQr));
});

renderDevices();
updateSecuritySummary();
renderSpeed();
renderEvents();
generateQr();
