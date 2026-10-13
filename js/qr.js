const qrMount = document.getElementById("qr-code");
const urlInput = document.getElementById("qr-url");
const updateBtn = document.getElementById("qr-update");
const printBtn = document.getElementById("qr-print");

function defaultUrl() {
  // Prefer the seating homepage for this deployment / local server.
  const url = new URL("index.html", window.location.href);
  url.hash = "";
  url.search = "";
  // Normalize .../qr.html → .../ or .../index.html
  if (url.pathname.endsWith("/qr.html")) {
    url.pathname = url.pathname.replace(/qr\.html$/, "") || "/";
  }
  return url.href;
}

function renderQr(text) {
  qrMount.innerHTML = "";
  if (typeof QRCode === "undefined") {
    qrMount.textContent = "QR library failed to load. Check your network and reload.";
    return;
  }

  QRCode.toCanvas(
    text,
    {
      width: 240,
      margin: 1,
      color: {
        dark: "#0A1628",
        light: "#FFFFFF",
      },
    },
    (error, canvas) => {
      if (error) {
        qrMount.textContent = "Could not generate QR code for that URL.";
        console.error(error);
        return;
      }
      qrMount.appendChild(canvas);
    }
  );
}

function syncFromInput() {
  const value = urlInput.value.trim() || defaultUrl();
  urlInput.value = value;
  renderQr(value);
}

urlInput.value = defaultUrl();
syncFromInput();

updateBtn.addEventListener("click", syncFromInput);
urlInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    syncFromInput();
  }
});
printBtn.addEventListener("click", () => window.print());
