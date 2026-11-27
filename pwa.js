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

  // Add the complete Dukops application as a separate tab without replacing
  // the existing A/B report application. Its own tabs run inside the iframe.
  const dukopsUrl = "https://sukasada05.github.io/dukops4/";
  const switcher = document.createElement("nav");
  switcher.id = "app-switcher";
  switcher.setAttribute("aria-label", "Pilih aplikasi");
  switcher.innerHTML = `
    <button type="button" class="app-switch-tab is-active" data-app-tab="reports" aria-selected="true">Laporan A/B</button>
    <button type="button" class="app-switch-tab" data-app-tab="dukops" aria-selected="false">DUKOPS</button>
  `;

  const dukopsPanel = document.createElement("section");
  dukopsPanel.id = "dukops-panel";
  dukopsPanel.hidden = true;
  dukopsPanel.setAttribute("aria-label", "Aplikasi DUKOPS dan seluruh tabnya");
  dukopsPanel.innerHTML = `
    <iframe title="Aplikasi DUKOPS Babinsa" allow="clipboard-read; clipboard-write" loading="lazy"></iframe>
    <a class="dukops-open-link" href="${dukopsUrl}" target="_blank" rel="noopener noreferrer">Buka DUKOPS di tab baru</a>
  `;
  document.body.insertBefore(dukopsPanel, document.body.firstChild);
  document.body.insertBefore(switcher, document.body.firstChild);

  const appSwitcherStyle = document.createElement("style");
  appSwitcherStyle.textContent = `
    #app-switcher {
      display:flex; justify-content:center; gap:8px; margin:0 auto 12px;
      padding:8px; width:fit-content; max-width:100%; border-radius:8px;
      background:#fff; box-shadow:0 2px 8px #0002; position:relative; z-index:20;
    }
    .app-switch-tab {
      border:1px solid #245c3b; border-radius:6px; padding:9px 16px;
      background:#fff; color:#19452b; cursor:pointer;
      font:700 14px Arial,Helvetica,sans-serif;
    }
    .app-switch-tab.is-active { background:#245c3b; color:#fff; }
    .app-switch-tab:focus-visible { outline:3px solid #8bb99c; outline-offset:2px; }
    #dukops-panel { width:100%; height:calc(100vh - 90px); min-height:560px; position:relative; }
    #dukops-panel[hidden] { display:none !important; }
    #dukops-panel iframe { display:block; width:100%; height:100%; min-height:560px; border:0; border-radius:8px; background:#0a1a3a; }
    .dukops-open-link { display:block; width:fit-content; margin:8px auto; color:#19452b; font:600 14px Arial,Helvetica,sans-serif; }
    body.dukops-mode > .date-controls,
    body.dukops-mode > .report-canvas { display:none !important; }
    body.dukops-mode { padding:12px; }
    @media (max-width:600px) {
      #app-switcher { width:100%; }
      .app-switch-tab { flex:1; padding:10px 8px; }
      #dukops-panel, #dukops-panel iframe { min-height:calc(100vh - 100px); }
      body.dukops-mode { padding:8px; }
    }
    @media print { #app-switcher, #dukops-panel { display:none !important; } }
  `;
  document.head.append(appSwitcherStyle);

  let dukopsLoaded = false;
  const tabButtons = [...switcher.querySelectorAll("[data-app-tab]")];
  const dukopsFrame = dukopsPanel.querySelector("iframe");
  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const showDukops = button.dataset.appTab === "dukops";
      document.body.classList.toggle("dukops-mode", showDukops);
      dukopsPanel.hidden = !showDukops;
      tabButtons.forEach((tab) => {
        const active = tab === button;
        tab.classList.toggle("is-active", active);
        tab.setAttribute("aria-selected", String(active));
      });
      if (showDukops && !dukopsLoaded) {
        dukopsFrame.src = dukopsUrl;
        dukopsLoaded = true;
      }
    });
  });

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
    // These controls are intentionally kept hidden; service worker install and
    // update checks continue to run in the background.
    button.hidden = true;
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
    installButton.hidden = true;
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
    if (choice?.outcome !== "accepted") installButton.hidden = true;
  });

  function showUpdateIfWaiting() {
    updateButton.hidden = true;
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
