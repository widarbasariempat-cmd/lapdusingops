(() => {
  const currentScript = document.currentScript;
  const scriptUrl = new URL(currentScript?.src || "pwa.js", location.href);
  const appBase = new URL("./", scriptUrl);
  const manifestLink = document.querySelector('link[rel="manifest"]');
  if (manifestLink) manifestLink.href = new URL("manifest.webmanifest", appBase).href;

  // Load the photo watermark processor even when service workers are unavailable.
  const watermarkScript = document.createElement("script");
  watermarkScript.src = new URL("photo-watermark.js", appBase).href;
  watermarkScript.async = false;
  document.head.append(watermarkScript);

  const controls = document.querySelector(".date-controls");
  if (!controls || !("serviceWorker" in navigator)) return;

  const buttonStyle = [
    "padding:6px 9px", "border:0", "border-radius:6px", "background:#245c3b",
    "color:#fff", "cursor:pointer", "font:700 14px Arial,Helvetica,sans-serif"
  ].join(";");
  function makeButton(id, label) {
    let button = document.getElementById(id);
    if (!button) {
      button = document.createElement("button");
      button.id = id;
      button.type = "button";
      button.className = "print-button pwa-control";
      button.style.cssText = buttonStyle;
      button.hidden = true;
      controls.append(button);
    }
    button.textContent = label;
    return button;
  }

  const installButton = makeButton("pwa-install-button", "Install aplikasi");
  const updateButton = makeButton("pwa-update-button", "Update aplikasi");
  let installPrompt = null;
  let registration = null;
  let reloading = false;

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    installButton.hidden = false;
  });
  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    installButton.hidden = true;
  });

  installButton.addEventListener("click", async () => {
    if (!installPrompt) return;
    const prompt = installPrompt;
    installPrompt = null;
    installButton.hidden = true;
    await prompt.prompt();
    const choice = await prompt.userChoice;
    if (choice?.outcome !== "accepted") {
      // A new beforeinstallprompt event will make the button available again if eligible.
      installButton.hidden = true;
    }
  });

  function showUpdateIfWaiting() {
    updateButton.hidden = !(registration?.waiting && navigator.serviceWorker.controller);
  }

  updateButton.addEventListener("click", () => {
    if (!registration?.waiting) {
      updateButton.hidden = true;
      return;
    }
    updateButton.disabled = true;
    updateButton.textContent = "Memperbarui…";
    registration.waiting.postMessage({ type: "SKIP_WAITING" });
  });

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    updateButton.hidden = true;
    if (reloading) return;
    reloading = true;
    location.reload();
  });

  navigator.serviceWorker.register(new URL("service-worker.js", appBase).href, { scope: appBase.pathname })
    .then((serviceWorkerRegistration) => {
      registration = serviceWorkerRegistration;
      showUpdateIfWaiting();
      registration.addEventListener("updatefound", () => {
        const installing = registration.installing;
        if (!installing) return;
        installing.addEventListener("statechange", () => {
          if (installing.state === "installed") showUpdateIfWaiting();
        });
      });
      registration.update().catch(() => {});
    })
    .catch((error) => console.warn("PWA service worker tidak dapat didaftarkan:", error));
})();
