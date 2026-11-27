const monthNames = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember"
];
const quarterNames = ["I", "II", "III", "IV"];
const monthSelect = document.querySelector("#report-month");
const yearSelect = document.querySelector("#report-year");
const villageSelect = document.querySelector("#report-village");
const reportTypeSelect = document.querySelector("#report-type");
const reportTypeOptions = {
  budget: reportTypeSelect.querySelector('option[value="budget"]'),
  photos: reportTypeSelect.querySelector('option[value="photos"]')
};
const reportTypeLabels = {
  budget: "Rincian dukungan anggaran",
  photos: "Dokumentasi foto"
};
const printButton = document.querySelector("#print-button");
const photoStatus = document.querySelector("#photo-status");
const photolacis = Array.from(document.querySelectorAll(".photo-laci"));
const reportDocument = document.querySelector(".document");
const budgetDocument = document.querySelector("#budget-document");
const yearControl = document.querySelector("#year-control");
const villageControl = document.querySelector("#village-control");
const selectionWarningDialog = document.querySelector("#selection-warning-dialog");
const now = new Date();
const currentYear = now.getFullYear();
const signatureExtensions = ["png", "jpg", "jpeg", "webp"];

let laciData = []; // array 9 elemen: { photoBlob, meta, txtLine } | null
let selectedReportType = "budget";

/* ===== INIT 9 laci ZIP ===== */
function initlaciInputs() {
  laciData = Array.from({ length: 9 }, () => null);
  photolacis.forEach((laci, index) => {
    const number = index + 1;
    laci.innerHTML = "";

    const preview = document.createElement("img");
    preview.className = "photo-preview";
    preview.alt = `Foto kegiatan ${number}`;
    preview.hidden = true;
    laci.append(preview);

    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".zip,application/zip";
    input.id = `laci-zip-input-${number}`;
    input.className = "laci-zip-input";
    input.setAttribute("aria-label", `Pilih ZIP kegiatan ${number}`);

    const label = document.createElement("label");
    label.htmlFor = input.id;
    label.className = "laci-zip-label";
    label.innerHTML = `<div class="laci-zip-icon">📁</div><div>Unggah ZIP</div><div style="font-size:9pt;opacity:.7">laci ${number}</div>`;

    const changeBtn = document.createElement("label");
    changeBtn.htmlFor = input.id;
    changeBtn.className = "laci-zip-change";
    changeBtn.textContent = "Ganti ZIP";

    laci.append(label, changeBtn, input);

    input.addEventListener("change", (e) => {
      const file = e.target.files && e.target.files[0];
      if (file) handlelaciZip(index, file);
      input.value = "";
    });
  });
}

/* ===== BACA 1 ZIP → laci ===== */
async function handlelaciZip(laciIndex, zipFile) {
  const number = laciIndex + 1;
  const laci = photolacis[laciIndex];
  const preview = laci.querySelector(".photo-preview");

  try {
    const archive = await window.ZipImageReader.readReportArchive(zipFile);

    // 1. Gambar
    const images = [...(archive.images || [])].sort((a, b) =>
      a.path.localeCompare(b.path, "id", { numeric: true, sensitivity: "base" })
    );
    const firstImage = images[0];

    // 2. JSON
    let meta = null;
    for (const j of (archive.json || [])) {
      try {
        const clean = String(j.text || "").replace(/^\uFEFF/, "");
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed) && parsed.length) {
          const r = parsed[0];
          meta = {
            koordinat: String(r.koordinat || "").trim(),
            nama_desa: String(r.nama_desa || "").trim(),
            tanggal:   String(r.tanggal || "").trim(),
            waktu:     String(r.waktu || "").trim()
          };
          break;
        }
      } catch {}
    }

    // 3. TXT
    let txtLine = null;
    for (const t of (archive.texts || [])) {
      const clean = String(t.text || "").replace(/^\uFEFF/, "");
      const firstLine = clean.split(/\r?\n/).find((l) => l.trim());
      if (firstLine) {
        const parts = firstLine.split("\t");
        if (parts.length >= 2) {
          txtLine = {
            date: parts[0].trim(),
            narrative: parts.slice(1).join("\t").trim()
          };
          break;
        }
      }
    }

    if (!firstImage) {
      alert(`ZIP laci ${number} tidak memiliki gambar.`);
      return;
    }

    // Preview
    if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
    const url = URL.createObjectURL(firstImage.blob);
    preview.dataset.objectUrl = url;
    preview.src = url;
    preview.hidden = false;
    laci.classList.add("has-image");

    // Simpan
    laciData[laciIndex] = { photoBlob: firstImage.blob, meta, txtLine };

    // Update Lampiran A
    updateBudgetRow(laciIndex, txtLine);

    // Set filter
    if (meta) applyMetaToFilters(meta);

    // Caption
    if (typeof window.photoMetadataByNumber !== "undefined") {
      if (meta) window.photoMetadataByNumber.set(number, meta);
      else window.photoMetadataByNumber.delete(number);
    }
    if (typeof window.PhotoJson !== "undefined" && window.PhotoJson.refreshAllCaptions) {
      setTimeout(() => window.PhotoJson.refreshAllCaptions(), 100);
    }

    updateStatusText();
  } catch (err) {
    alert(`ZIP laci ${number} gagal dibaca: ${err.message}`);
  }
}

function updateBudgetRow(laciIndex, txtLine) {
  const allRows = Array.from(budgetDocument.querySelectorAll(".budget-table tbody tr"));
  const row = allRows[laciIndex];
  if (!row) return;
  row.cells[1].textContent = txtLine?.date || "";
  row.cells[2].textContent = txtLine?.narrative || "";
}

function applyMetaToFilters(meta) {
  if (!meta.tanggal) return;
  const m = meta.tanggal.trim().match(/^(\d{1,2})\s+([\p{L}]+)\s+(\d{4})$/u);
  if (!m) return;
  const monthIndex = monthNames.findIndex((mo) =>
    mo.toLocaleLowerCase("id-ID") === m[2].toLocaleLowerCase("id-ID")
  );
  const year = Number(m[3]);
  if (monthIndex < 0) return;

  if (!monthSelect.value || monthSelect.value === "") monthSelect.value = String(monthIndex);
  if (!yearSelect.value || yearSelect.value === "") yearSelect.value = String(year);
  if (meta.nama_desa && (!villageSelect.value || villageSelect.value === "")) {
    const option = Array.from(villageSelect.options).find((o) =>
      o.value.toLocaleLowerCase("id-ID") === meta.nama_desa.toLocaleLowerCase("id-ID")
    );
    if (option) villageSelect.value = option.value;
  }

  updateSelectionStyles();
  updateReportPeriod();
  updateBabinsa();
  if (typeof window.applyVillage === "function" && villageSelect.value) {
    window.applyVillage(villageSelect.value);
  }
}

function updateStatusText() {
  const filled = laciData.filter((s) => s && s.photoBlob).length;
  if (photoStatus) photoStatus.textContent = `${filled}/9 laci terisi`;
  updateReportTypeLabel("photos", filled, "foto");
}

function updateReportTypeLabel(type, successCount, resultName) {
  if (!reportTypeOptions[type]) return;
  const resultLabel = `${reportTypeLabels[type]} (${successCount} ${resultName} berhasil)`;
  reportTypeOptions[type].textContent = resultLabel;
}

function fitDocumentToViewport() {
  const bodyStyle = getComputedStyle(document.body);
  const horizontalPadding = Number.parseFloat(bodyStyle.paddingLeft) + Number.parseFloat(bodyStyle.paddingRight);
  const availableWidth = Math.max(1, window.innerWidth - horizontalPadding);
  const pageWidth = 297 * 96 / 25.4;
  const zoom = String(Math.min(1, availableWidth / pageWidth));
  document.querySelectorAll(".report-canvas").forEach((canvas) => { canvas.style.zoom = zoom; });
}
window.addEventListener("resize", fitDocumentToViewport);
fitDocumentToViewport();

if (!window.reportData) throw new Error("Data laporan tidak ditemukan.");

const villageNames = window.reportData.villageOrder || [...window.reportData.desaList, ...window.reportData.kelurahanList];
const villagePlaceholder = document.createElement("option");
villagePlaceholder.value = "";
villagePlaceholder.textContent = "-Pilih desa/kelurahan-";
villagePlaceholder.disabled = true;
villagePlaceholder.selected = true;
villageSelect.append(villagePlaceholder);

villageNames.forEach((village) => {
  const option = document.createElement("option");
  option.value = village;
  option.textContent = village;
  villageSelect.append(option);
});
monthNames.forEach((month, index) => {
  const option = document.createElement("option");
  option.value = index;
  option.textContent = month;
  monthSelect.append(option);
});
for (let year = currentYear - 5; year <= currentYear + 5; year++) {
  const option = document.createElement("option");
  option.value = year;
  option.textContent = year;
  yearSelect.append(option);
}
monthSelect.value = String(now.getMonth());
yearSelect.value = String(currentYear);
yearControl.hidden = false;
villageControl.hidden = false;

function updateReportPeriod() {
  if (!monthSelect.value || !yearSelect.value) return;
  const monthIndex = Number(monthSelect.value);
  const year = Number(yearSelect.value);
  const month = monthNames[monthIndex];
  const quarter = quarterNames[Math.floor(monthIndex / 3)];
  const lastDay = new Date(year, monthIndex + 1, 0).getDate();
  document.querySelector("#attachment-period").textContent = `Bulan ${month} Triwulan ${quarter} TA ${year}`;
  document.querySelector("#title-period").textContent = `${month.toUpperCase()} TRIWULAN ${quarter} TA ${year}`;
  document.querySelector("#signature-date").textContent = `${lastDay} ${month} ${year}`;
  document.querySelectorAll(".budget-attachment-period").forEach((el) => { el.textContent = `${month} Triwulan ${quarter} TA ${year}`; });
  document.querySelectorAll(".budget-title-period").forEach((el) => { el.textContent = `${month.toUpperCase()} TRIWULAN ${quarter} TA ${year}`; });
  document.querySelectorAll(".signature-date").forEach((el) => { el.textContent = `${lastDay} ${month} ${year}`; });
}

function updateSelectionStyles() {
  [monthSelect, yearSelect, villageSelect].forEach((select) => { select.classList.toggle("has-selection", Boolean(select.value)); });
}

function hasReportSelection() {
  return Boolean(monthSelect.value && yearSelect.value && villageSelect.value);
}

function showSelectionWarning(action) {
  const missing = [];
  if (!monthSelect.value) missing.push("bulan");
  if (!yearSelect.value) missing.push("tahun");
  if (!villageSelect.value) missing.push("desa/kelurahan");
  document.querySelector("#selection-warning-title").textContent = "";
  document.querySelector("#selection-warning-message").textContent = `Pilih ${missing.join(", ")} ${action}.`;
  selectionWarningDialog.showModal();
}

function updateVillageLabels(village) {
  document.querySelectorAll(".signature-village").forEach((el) => { el.textContent = village; });
}

function setImageFromCandidates(image, candidates) {
  image.hidden = true;
  image.removeAttribute("src");
  const className = image.classList.contains("stamp-image") ? "has-stamp-image" : "has-signature-image";
  image.parentElement.classList.remove(className);
  let i = 0;
  const next = () => { if (i >= candidates.length) return; image.src = candidates[i++]; };
  image.onload = () => { image.hidden = false; image.parentElement.classList.add(className); };
  image.onerror = () => next();
  next();
}

function imagePaths(folder, names) {
  const encodedFolder = folder.split("/").map(encodeURIComponent).join("/");
  return names.flatMap((name) => signatureExtensions.map((ext) => {
    const encodedName = name.split("/").map(encodeURIComponent);
    encodedName[encodedName.length - 1] += `.${ext}`;
    return `${encodedFolder}/${encodedName.join("/")}`;
  }));
}

function updateBabinsa() {
  const village = villageSelect.value;
  const babinsa = window.reportData.babinsaByVillage[village] || { name: "", rank: "", nrp: "" };
  updateVillageLabels(village);
  document.querySelectorAll(".babinsa-name").forEach((el) => { el.textContent = babinsa.name; });
  document.querySelectorAll(".babinsa-rank").forEach((el) => { el.textContent = babinsa.rank; });
  document.querySelectorAll(".babinsa-nrp").forEach((el) => { el.textContent = babinsa.nrp; });
  const candidates = babinsa.nrp ? [
    ...imagePaths("data/tanda tangan/Babinsa", [babinsa.nrp, `tanda tangan ${babinsa.nrp}`]),
    ...imagePaths(`data/tanda tangan/${village}`, [babinsa.nrp, `tanda tangan ${babinsa.nrp}`]),
    ...imagePaths("data/tanda tangan", [`${village}/${babinsa.nrp}`, `tanda tangan ${babinsa.nrp}`, babinsa.nrp])
  ] : [];
  document.querySelectorAll(".babinsa-signature-space").forEach((space) => {
    let sig = space.querySelector(".signature-image");
    if (!sig) {
      sig = document.createElement("img");
      sig.className = "signature-image";
      sig.hidden = true;
      space.append(sig);
    }
    sig.alt = `Tanda tangan ${babinsa.name || "Babinsa"}`;
    setImageFromCandidates(sig, candidates);
  });
}

function createBudgetRow(number) {
  const row = document.createElement("tr");
  const values = [
    { text: `${number}.`, editable: false },
    { text: "", editable: true },
    { text: "", editable: true },
    { text: "Rp. 100.000,-", editable: true },
    { text: "Kegiatan berjalan dengan tertib, aman dan lancar.", editable: true }
  ];
  values.forEach(({ text, editable }) => {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (editable) { cell.contentEditable = "true"; cell.spellcheck = false; }
    row.append(cell);
  });
  return row;
}
for (let number = 1; number <= 9; number++) {
  const target = number <= 5 ? document.querySelector("#budget-rows-first") : document.querySelector("#budget-rows-second");
  target.append(createBudgetRow(number));
}

initlaciInputs();

setImageFromCandidates(document.querySelector("#unit-stamp-image"), ["data/stempel/stempel.png"]);
setImageFromCandidates(document.querySelector("#budget-unit-stamp-image"), ["data/stempel/stempel.png"]);
setImageFromCandidates(document.querySelector("#commander-signature-image"), imagePaths("data/tanda tangan", ["3910357550170", "Koramil/3910357550170"]));
setImageFromCandidates(document.querySelector("#budget-commander-signature-image"), imagePaths("data/tanda tangan", ["3910357550170", "Koramil/3910357550170"]));

monthSelect.addEventListener("change", () => { updateSelectionStyles(); updateReportPeriod(); });
yearSelect.addEventListener("change", () => { updateSelectionStyles(); updateReportPeriod(); });
villageSelect.addEventListener("change", () => {
  updateBabinsa();
  updateSelectionStyles();
  if (typeof window.applyVillage === "function") window.applyVillage(villageSelect.value);
});

let originalDocumentTitle = document.title;
if (printButton) {
  printButton.addEventListener("click", () => {
    if (!hasReportSelection()) { showSelectionWarning("mencetak laporan"); return; }
    const safeVillageName = villageSelect.value.replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-");
    const villageNumber = window.reportData.villageReportNumberByVillage[villageSelect.value];
    originalDocumentTitle = document.title;
    document.title = `${villageNumber}. A-B ${safeVillageName} ${monthNames[Number(monthSelect.value)].toLocaleLowerCase("id-ID")} ${yearSelect.value}`;
    document.body.classList.remove("printing-a", "printing-b", "printing-both");
    document.body.classList.add("printing-both");
    document.body.insertBefore(budgetDocument, reportDocument);
    window.print();
  });
}

window.addEventListener("afterprint", () => {
  document.title = originalDocumentTitle;
  document.body.classList.remove("printing-a", "printing-b", "printing-both");
  document.body.insertBefore(reportDocument, budgetDocument);
});

updateSelectionStyles();
updateReportPeriod();
updateBabinsa();
