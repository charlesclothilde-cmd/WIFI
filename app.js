const devices = [
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
  grid.innerHTML = devices
    .map((device) => {
      const badgeClass = device.status === "unknown" ? "badge warn" : "badge";
      return `
        <article class="device-card">
          <header>
            <strong>${device.name}</strong>
            <span class="${badgeClass}">${device.status}</span>
          </header>
          <small>${device.type}</small>
          <span>${device.ip}</span>
        </article>
      `;
    })
    .join("");

  document.querySelector("#knownCount").textContent = devices.filter((device) => device.status === "known").length;
  document.querySelector("#alertCount").textContent = devices.filter((device) => device.status === "unknown").length;
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

document.querySelector("#scanDevices").addEventListener("click", () => {
  const knownDevice = { name: "Kitchen Speaker", ip: "192.168.1.63", type: "Audio", status: "known" };
  if (!devices.some((device) => device.ip === knownDevice.ip)) {
    devices.splice(3, 0, knownDevice);
  }
  renderDevices();
});

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
renderSpeed();
renderEvents();
generateQr();
