/* =====================================================================
 * photo-json.js — Caption foto dari gabungan.json
 * Dipanggil OTOMATIS dari script.js saat ZIP berisi .json dideteksi.
 * Caption: kanan bawah, Arial 11pt, rata kanan, ikut tercetak.
 * ===================================================================== */
(function () {
  "use strict";

  const MONTHS = [
    "Januari","Februari","Maret","April","Mei","Juni",
    "Juli","Agustus","September","Oktober","November","Desember"
  ];

  window.photoMetadataByNumber = window.photoMetadataByNumber || new Map();

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

  function formatBabinsaLine(namaDesa) {
    const v = String(namaDesa || "").trim();
    if (!v) return "Babinsa";
    return v.toLocaleLowerCase("id-ID") === "sukasada"
      ? "Babinsa Kelurahan Sukasada"
      : "Babinsa " + v;
  }

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
    console.log("[photo-json] " + map.size + " metadata tersimpan (foto 1.." + map.size + ")");
  }

  function applyCaptionToFrame(frame, number) {
    if (!frame) return;
    removeCaptionFromFrame(frame);
    if (!frame.classList.contains("has-image")) return;

    const meta = window.photoMetadataByNumber.get(number);
    if (!meta) return;

    const cap = document.createElement("div");
    cap.className = "photo-caption";
    cap.setAttribute("aria-hidden", "true");
    cap.innerHTML =
      '<span class="cap-babinsa">'   + esc(formatBabinsaLine(meta.nama_desa)) + '</span>' +
      '<span class="cap-koordinat">' + esc(meta.koordinat) + '</span>' +
      '<span class="cap-waktu">'     + esc(meta.tanggal) + ' ' + esc(meta.waktu) + '</span>';
    frame.appendChild(cap);
  }

  function removeCaptionFromFrame(frame) {
    if (!frame) return;
    const old = frame.querySelectorAll(".photo-caption");
    for (let i = 0; i < old.length; i++) old[i].remove();
  }

  function refreshAllCaptions() {
    const frames = document.querySelectorAll("#photo-document .photo-frame");
    frames.forEach(function (frame, idx) { applyCaptionToFrame(frame, idx + 1); });
  }

  function watchFrames() {
    const frames = document.querySelectorAll("#photo-document .photo-frame");
    if (!frames.length) return;
    frames.forEach(function (frame, idx) {
      const number = idx + 1;
      const observer = new MutationObserver(function () {
        if (frame.classList.contains("has-image")) {
          requestAnimationFrame(function () { applyCaptionToFrame(frame, number); });
        } else {
          removeCaptionFromFrame(frame);
        }
      });
      observer.observe(frame, { attributes: true, attributeFilter: ["class"] });
    });
    refreshAllCaptions();
  }

  async function ingest(text, options) {
    const opts = (options && typeof options === "object") ? options : {};
    const source = opts.source || "(langsung)";

    const clean = String(text || "").replace(/^\uFEFF/, "");
    const records = JSON.parse(clean);

    if (!Array.isArray(records) || !records.length) {
      throw new Error("JSON harus berupa array berisi minimal 1 data.");
    }

    const normalized = records.map(function (r, i) {
      if (!r || typeof r !== "object" || Array.isArray(r)) {
        throw new Error("Data ke-" + (i + 1) + " bukan objek JSON.");
      }
      const date = parseIndoDate(r.tanggal);
      if (!date) throw new Error("Data ke-" + (i + 1) + ": tanggal tidak valid (contoh: 05 November 2026).");
      if (!r.nama_desa || !String(r.nama_desa).trim()) throw new Error("Data ke-" + (i + 1) + ": nama_desa kosong.");
      if (!r.koordinat || !String(r.koordinat).trim()) throw new Error("Data ke-" + (i + 1) + ": koordinat kosong.");
      if (!r.waktu || !String(r.waktu).trim()) throw new Error("Data ke-" + (i + 1) + ": waktu kosong.");
      return {
        koordinat: String(r.koordinat).trim(),
        nama_desa: String(r.nama_desa).trim(),
        tanggal:   String(r.tanggal).trim(),
        waktu:     String(r.waktu).trim(),
        _date:     date
      };
    });

    const first = normalized[0];
    const samePeriod = normalized.every(function (r) {
      return r.nama_desa.toLocaleLowerCase("id-ID") === first.nama_desa.toLocaleLowerCase("id-ID") &&
             r._date.monthIndex === first._date.monthIndex &&
             r._date.year === first._date.year;
    });
    if (!samePeriod) throw new Error("Semua data dalam JSON harus memiliki desa, bulan, dan tahun yang sama.");

    const villageSelect = document.getElementById("report-village");
    const monthSelect   = document.getElementById("report-month");
    const yearSelect    = document.getElementById("report-year");
    const photoStatus   = document.getElementById("photo-status");

    const villageOption = Array.from(villageSelect.options).find(function (opt) {
      return opt.value.toLocaleLowerCase("id-ID") === first.nama_desa.toLocaleLowerCase("id-ID");
    });
    if (!villageOption) throw new Error("Desa '" + first.nama_desa + "' tidak ada di daftar laporan.");

    const yearValue = String(first._date.year);
    if (!Array.from(yearSelect.options).some(function (o) { return o.value === yearValue; })) {
      const opt = document.createElement("option");
      opt.value = yearValue;
      opt.textContent = yearValue;
      yearSelect.appendChild(opt);
    }

    monthSelect.value = String(first._date.monthIndex);
    yearSelect.value = yearValue;
    villageSelect.value = villageOption.value;
    monthSelect.classList.add("has-selection");
    yearSelect.classList.add("has-selection");
    villageSelect.classList.add("has-selection");

    if (typeof window.updateReportPeriod === "function") window.updateReportPeriod();
    if (typeof window.updateBabinsa === "function") window.updateBabinsa();
    if (typeof window.updateSelectionStyles === "function") window.updateSelectionStyles();
    if (typeof window.applyVillage === "function") window.applyVillage(villageOption.value);

    storeMetadata(normalized);

    if (!opts.skipLoad) {
      if (typeof window.loadPhotosFromSelectedVillage === "function") window.loadPhotosFromSelectedVillage();
    }

    const dateLabel = String(first._date.day).padStart(2, "0") + " " +
                      MONTHS[first._date.monthIndex] + " " + first._date.year;
    const info = normalized.length + " data JSON dimuat untuk " +
                 first.nama_desa + ", " + dateLabel + " (sumber: " + source + ").";

    if (photoStatus) photoStatus.textContent = info;
    console.log("[photo-json] " + info);

    setTimeout(refreshAllCaptions, 300);
    setTimeout(refreshAllCaptions, 900);
    setTimeout(refreshAllCaptions, 1800);

    return normalized;
  }

  document.addEventListener("DOMContentLoaded", function () {
    watchFrames();
  });

  window.PhotoJson = {
    ingest: ingest,
    refreshAllCaptions: refreshAllCaptions,
    storeMetadata: storeMetadata,
    getMeta: function (n) { return window.photoMetadataByNumber.get(n); }
  };
})();