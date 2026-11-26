/* =====================================================================
 * photo-json.js  —  Modul caption foto dari gabungan.json
 * ---------------------------------------------------------------------
 * FUNGSI:
 *   - Menempel ke input JSON yang dibuat otomatis oleh report-data.js
 *   - Membaca gabungan.json → simpan metadata per-slot ke Map
 *   - Menempelkan caption di KIRI BAWAH tiap foto:
 *        koordinat / nama_desa / tanggal + waktu
 *   - Caption HANYA tampil di layar. Saat cetak, caption disembunyikan
 *     via CSS @media print → hasil cetak IDENTIK versi sebelumnya.
 *
 * TIDAK MENGUBAH:
 *   script.js, zip-reader.js, watermark.js, report-data.js, HTML body.
 * ===================================================================== */
(function () {
  "use strict";

  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  // Map global slot (1..9) → metadata
  window.photoMetadataByNumber = window.photoMetadataByNumber || new Map();

  // ---------- Util ----------
  function parseIndoDate(value) {
    if (typeof value !== "string") return null;
    const m = value.trim().match(/^(\d{1,2})\s+([\p{L}]+)\s+(\d{4})$/u);
    if (!m) return null;
    const mi = MONTHS.findIndex(function (mo) {
      return mo.toLocaleLowerCase("id-ID") === m[2].toLocaleLowerCase("id-ID");
    });
    const day = Number(m[1]);
    const year = Number(m[3]);
    if (mi < 0 || day < 1 || day > new Date(year, mi + 1, 0).getDate()) return null;
    return { day: day, monthIndex: mi, year: year };
  }

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // ---------- Simpan metadata ke Map ----------
  function storeMetadata(records) {
    const map = new Map();
    records.forEach(function (r, i) {
      const n = i + 1;
      if (n > 9) return;
      map.set(n, {
        koordinat: String(r.koordinat || "").trim(),
        nama_desa: String(r.nama_desa || "").trim(),
        tanggal:   String(r.tanggal || "").trim(),
        waktu:     String(r.waktu || "").trim()
      });
    });
    window.photoMetadataByNumber = map;
    console.log("[photo-json] " + map.size + " metadata tersimpan (slot 1.." + map.size + ")");
  }

  // ---------- Tempel / hapus caption di slot ----------
  function applyCaptionToSlot(slot, number) {
    if (!slot) return;
    removeCaptionFromSlot(slot);
    if (!slot.classList.contains("has-image")) return;

    const meta = window.photoMetadataByNumber.get(number);
    if (!meta) return;

    const cap = document.createElement("div");
    cap.className = "photo-caption";
    cap.setAttribute("aria-hidden", "true");
    cap.innerHTML =
      '<span class="cap-koordinat">' + esc(meta.koordinat) + '</span>' +
      '<span class="cap-desa">'    + esc(meta.nama_desa) + '</span>' +
      '<span class="cap-waktu">'   + esc(meta.tanggal) + ' ' + esc(meta.waktu) + '</span>';
    slot.appendChild(cap);
  }

  function removeCaptionFromSlot(slot) {
    if (!slot) return;
    const old = slot.querySelectorAll(".photo-caption");
    for (let i = 0; i < old.length; i++) old[i].remove();
  }

  function refreshAllCaptions() {
    const slots = document.querySelectorAll("#photo-document .photo-slot");
    slots.forEach(function (slot, idx) {
      applyCaptionToSlot(slot, idx + 1);
    });
  }

  // ---------- Amati perubahan class .photo-slot ----------
  // Saat script.js menambahkan "has-image" → caption ditempel
  // Saat "has-image" dihapus (ganti desa) → caption dibersihkan
  function watchSlots() {
    const slots = document.querySelectorAll("#photo-document .photo-slot");
    if (!slots.length) return;

    slots.forEach(function (slot, idx) {
      const number = idx + 1;
      const observer = new MutationObserver(function () {
        if (slot.classList.contains("has-image")) {
          requestAnimationFrame(function () {
            applyCaptionToSlot(slot, number);
          });
        } else {
          removeCaptionFromSlot(slot);
        }
      });
      observer.observe(slot, { attributes: true, attributeFilter: ["class"] });
    });

    refreshAllCaptions();
  }

  // ---------- Temukan input JSON yang dibuat report-data.js ----------
  function findJsonInput() {
    const all = document.querySelectorAll('input[type="file"]');
    for (let i = 0; i < all.length; i++) {
      const el = all[i];
      if (el.accept && el.accept.indexOf("json") !== -1) return el;
    }
    return null;
  }

  function hookJsonInput() {
    const input = findJsonInput();
    if (!input) {
      console.warn("[photo-json] Input JSON tidak ditemukan. Modul siap, tapi belum ada pemicu.");
      return;
    }

    input.addEventListener("change", async function (ev) {
      const file = ev.target.files && ev.target.files[0];
      if (!file) return;
      try {
        const text = (await file.text()).replace(/^\uFEFF/, "");
        const records = JSON.parse(text);
        if (!Array.isArray(records) || !records.length) {
          throw new Error("JSON harus berupa array berisi minimal 1 data.");
        }
        records.forEach(function (r, i) {
          if (!parseIndoDate(r.tanggal)) {
            throw new Error("Data ke-" + (i + 1) + ": tanggal tidak valid (contoh: 05 November 2026).");
          }
        });
        storeMetadata(records);

        // report-data.js sudah menyetel filter & memanggil loadPhotos
        setTimeout(refreshAllCaptions, 300);
        setTimeout(refreshAllCaptions, 900);
        setTimeout(refreshAllCaptions, 1800);
      } catch (err) {
        console.warn("[photo-json] Gagal baca JSON:", err.message);
      }
    });

    console.log("[photo-json] Menempel ke input JSON yang sudah ada.");
  }

  // ---------- Init ----------
  document.addEventListener("DOMContentLoaded", function () {
    watchSlots();
    hookJsonInput();
  });

  // Expose untuk debugging manual
  window.PhotoJson = {
    storeMetadata: storeMetadata,
    refreshAllCaptions: refreshAllCaptions,
    getMeta: function (n) { return window.photoMetadataByNumber.get(n); }
  };
})();