/* =====================================================================
 * draft-manager.js — Draf otomatis (localStorage + IndexedDB untuk foto)
 * Menyimpan: dropdown, isi tabel anggaran, caption foto, dan blob foto.
 * Setelah refresh, semua otomatis dipulihkan.
 * ===================================================================== */
(function () {
  "use strict";

  const DRAFT_KEY  = "lapdusingops_draft_v2";
  const DB_NAME    = "lapdusingops_foto_db";
  const DB_VERSION = 1;
  const STORE      = "photos";
  const SAVE_DELAY = 400;

  let saveTimer   = null;
  let isRestoring = false;
  let dbPromise   = null;

  /* ---------- IndexedDB ---------- */
  function openDB() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!("indexedDB" in window)) return reject(new Error("IndexedDB tidak didukung"));
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE, { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
    return dbPromise;
  }
  async function idbPut(rec) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).put(rec);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }
  async function idbGetAll() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly");
      const rq = tx.objectStore(STORE).getAll();
      rq.onsuccess = () => res(rq.result || []);
      rq.onerror   = () => rej(rq.error);
    });
  }
  async function idbClear() {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).clear();
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }
  async function idbDelete(id) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readwrite");
      tx.objectStore(STORE).delete(id);
      tx.oncomplete = () => res();
      tx.onerror    = () => rej(tx.error);
    });
  }

  /* ---------- Util ---------- */
  const qs  = (s) => document.querySelector(s);
  const qsa = (s) => Array.from(document.querySelectorAll(s));

  function showToast(msg, type) {
    let t = document.getElementById("draft-toast");
    if (!t) { t = document.createElement("div"); t.id = "draft-toast"; document.body.appendChild(t); }
    t.className = "draft-toast " + (type || "info");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._h);
    t._h = setTimeout(() => t.classList.remove("show"), 3000);
  }

  function blobToArrayBuffer(blob) {
    return new Promise((res, rej) => {
      const r = new FileReader();
      r.onload  = () => res(r.result);
      r.onerror = () => rej(r.error);
      r.readAsArrayBuffer(blob);
    });
  }

  /* ---------- Kumpulkan data ---------- */
  function collectDraft() {
    const budgetRows = qsa("#budget-document .budget-table tbody tr").map((row) =>
      Array.from(row.cells).map((c) => c.textContent)
    );

    const photoMeta = {};
    if (window.photoMetadataByNumber && window.photoMetadataByNumber.size) {
      window.photoMetadataByNumber.forEach((m, n) => {
        photoMeta[n] = {
          koordinat: m.koordinat || "",
          nama_desa: m.nama_desa || "",
          tanggal:   m.tanggal   || "",
          waktu:     m.waktu     || ""
        };
      });
    }

    const framesWithImage = [];
    if (Array.isArray(window.frameData)) {
      window.frameData.forEach((it, i) => { if (it && it.photoBlob) framesWithImage.push(i); });
    }

    return {
      savedAt: new Date().toISOString(),
      month:   qs("#report-month")   ? qs("#report-month").value   : "",
      year:    qs("#report-year")    ? qs("#report-year").value    : "",
      village: qs("#report-village") ? qs("#report-village").value : "",
      budgetRows, photoMeta, framesWithImage
    };
  }

  /* ---------- Simpan blob foto ---------- */
  async function persistPhotosToIDB() {
    if (!Array.isArray(window.frameData)) return;
    for (let i = 0; i < window.frameData.length; i++) {
      const it = window.frameData[i];
      if (!it || !it.photoBlob) { try { await idbDelete(i + 1); } catch (e) {} continue; }
      try {
        const buf = await blobToArrayBuffer(it.photoBlob);
        await idbPut({
          id: i + 1,
          buffer: buf,
          type: it.photoBlob.type || "image/jpeg",
          meta: it.meta || null,
          txtLine: it.txtLine || null,
          savedAt: Date.now()
        });
      } catch (e) { console.warn("[draft] foto " + (i + 1) + " gagal:", e); }
    }
  }

  async function saveNow() {
    try {
      const draft = collectDraft();
      localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      await persistPhotosToIDB();
      updateDraftIndicator(draft.savedAt);
    } catch (e) { console.warn("[draft] simpan gagal:", e.message); }
  }

  function scheduleSave() {
    if (isRestoring) return;
    clearTimeout(saveTimer);
    saveTimer = setTimeout(saveNow, SAVE_DELAY);
  }

  /* ---------- Pulihkan dropdown/tabel/caption ---------- */
  function restoreFormFields(draft) {
    const mSel = qs("#report-month");
    const ySel = qs("#report-year");
    const vSel = qs("#report-village");

    if (draft.year && ySel && !Array.from(ySel.options).some((o) => o.value === String(draft.year))) {
      const o = document.createElement("option");
      o.value = String(draft.year); o.textContent = String(draft.year);
      ySel.appendChild(o);
    }
    if (draft.month   && mSel) mSel.value = draft.month;
    if (draft.year    && ySel) ySel.value = String(draft.year);
    if (draft.village && vSel) vSel.value = draft.village;

    try {
      if (typeof window.updateReportPeriod    === "function") window.updateReportPeriod();
      if (typeof window.updateSelectionStyles === "function") window.updateSelectionStyles();
      if (typeof window.updateBabinsa         === "function") window.updateBabinsa();
      if (typeof window.applyVillage === "function" && draft.village) window.applyVillage(draft.village);
    } catch (e) {}

    if (Array.isArray(draft.budgetRows)) {
      const rows = qsa("#budget-document .budget-table tbody tr");
      draft.budgetRows.forEach((cells, i) => {
        if (!rows[i]) return;
        cells.forEach((txt, j) => { if (rows[i].cells[j]) rows[i].cells[j].textContent = txt; });
      });
    }

    if (draft.photoMeta && typeof draft.photoMeta === "object") {
      if (!window.photoMetadataByNumber) window.photoMetadataByNumber = new Map();
      Object.keys(draft.photoMeta).forEach((k) => {
        const n = Number(k), m = draft.photoMeta[k];
        if (m) window.photoMetadataByNumber.set(n, m);
      });
    }
  }

  /* ---------- Pulihkan foto ---------- */
  async function restorePhotosFromIDB() {
    let recs;
    try { recs = await idbGetAll(); } catch (e) { return; }
    if (!recs.length) return;

    if (!Array.isArray(window.frameData)) window.frameData = Array.from({ length: 9 }, () => null);
    const frames = qsa("#photo-document .photo-frame");

    for (const rec of recs) {
      const idx = rec.id - 1, frame = frames[idx];
      if (!frame) continue;
      const blob = new Blob([rec.buffer], { type: rec.type || "image/jpeg" });
      const preview = frame.querySelector(".photo-preview");
      if (!preview) continue;
      if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
      const url = URL.createObjectURL(blob);
      preview.dataset.objectUrl = url;
      preview.src = url;
      preview.hidden = false;
      frame.classList.add("has-image");
      window.frameData[idx] = { photoBlob: blob, meta: rec.meta || null, txtLine: rec.txtLine || null };
      if (rec.txtLine && typeof window.updateBudgetRow === "function") {
        try { window.updateBudgetRow(idx, rec.txtLine); } catch (e) {}
      }
    }

    if (typeof window.PhotoJson !== "undefined" && window.PhotoJson.refreshAllCaptions) {
      setTimeout(() => window.PhotoJson.refreshAllCaptions(), 250);
      setTimeout(() => window.PhotoJson.refreshAllCaptions(), 800);
    }
    if (typeof window.updateStatusText === "function") { try { window.updateStatusText(); } catch (e) {} }
  }

  /* ---------- Pulihkan semua ---------- */
  async function restoreDraft() {
    const raw = localStorage.getItem(DRAFT_KEY);
    let draft = null;
    if (raw) { try { draft = JSON.parse(raw); } catch (e) {} }

    isRestoring = true;
    if (draft) restoreFormFields(draft);
    await restorePhotosFromIDB();
    isRestoring = false;

    if (draft) {
      updateDraftIndicator(draft.savedAt);
      const n = draft.framesWithImage ? draft.framesWithImage.length : 0;
      showToast(`Draf dipulihkan${n ? " (" + n + " foto)" : ""}.`, "info");
      return true;
    }
    updateDraftIndicator(null);
    return false;
  }

  /* ---------- Hapus semua ---------- */
  async function clearDraft(showMsg) {
    localStorage.removeItem(DRAFT_KEY);
    try { await idbClear(); } catch (e) {}

    qsa("#photo-document .photo-frame").forEach((frame) => {
      const p = frame.querySelector(".photo-preview");
      if (p) {
        if (p.dataset.objectUrl) URL.revokeObjectURL(p.dataset.objectUrl);
        p.removeAttribute("src"); p.hidden = true;
      }
      frame.classList.remove("has-image");
      const cap = frame.querySelector(".photo-caption");
      if (cap) cap.remove();
    });

    qsa("#budget-document .budget-table tbody tr").forEach((row) => {
      if (row.cells[1]) row.cells[1].textContent = "";
      if (row.cells[2]) row.cells[2].textContent = "";
    });

    if (Array.isArray(window.frameData)) window.frameData = Array.from({ length: 9 }, () => null);
    if (window.photoMetadataByNumber) window.photoMetadataByNumber.clear();

    updateDraftIndicator(null);
    if (showMsg !== false) showToast("Draf dihapus. Formulir siap dari awal.", "success");
  }

  /* ---------- Indikator ---------- */
  function updateDraftIndicator(savedAt) {
    const b = document.getElementById("draft-indicator");
    if (!b) return;
    if (!savedAt) { b.textContent = "Belum ada draf"; b.classList.remove("has-draft"); return; }
    const d = new Date(savedAt);
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    b.textContent = `💾 Draf tersimpan ${hh}:${mm}`;
    b.classList.add("has-draft");
  }

  /* ---------- Listener ---------- */
  function attachListeners() {
    ["#report-month", "#report-year", "#report-village"].forEach((s) => {
      const el = qs(s); if (el) el.addEventListener("change", scheduleSave);
    });

    qsa('#budget-document .budget-table td[contenteditable="true"]').forEach((cell) => {
      cell.addEventListener("input", scheduleSave);
      cell.addEventListener("blur",  scheduleSave);
    });

    const orig = window.handleFrameZip;
    if (typeof orig === "function" && !orig._draftWrapped) {
      window.handleFrameZip = async function (...a) {
        const r = await orig.apply(this, a);
        await saveNow();
        return r;
      };
      window.handleFrameZip._draftWrapped = true;
    }

    const cb = document.getElementById("clear-draft-button");
    if (cb) cb.addEventListener("click", async () => {
      if (confirm("Hapus draf tersimpan (termasuk foto)? Formulir akan dikosongkan.")) await clearDraft(true);
    });

    window.addEventListener("afterprint", () => {
      setTimeout(() => {
        if (localStorage.getItem(DRAFT_KEY) &&
            confirm("Laporan sudah dicetak. Hapus draf agar bersih untuk laporan berikutnya?"))
          clearDraft(true);
      }, 500);
    });

    window.addEventListener("beforeunload", () => {
      if (!isRestoring) { try { localStorage.setItem(DRAFT_KEY, JSON.stringify(collectDraft())); } catch (e) {} }
    });
  }

  function init() {
    setTimeout(async () => {
      attachListeners();
      await restoreDraft();
    }, 600);
  }

  if (document.readyState === "complete" || document.readyState === "interactive") init();
  else window.addEventListener("DOMContentLoaded", init);

  window.DraftManager = {
    save: saveNow, restore: restoreDraft, clear: clearDraft,
    get: () => { try { return JSON.parse(localStorage.getItem(DRAFT_KEY) || "null"); } catch { return null; } }
  };
})();