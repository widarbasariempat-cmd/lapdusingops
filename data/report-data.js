window.reportData = {
  villageOrder: [
    "Ambengan",
    "Pegayaman",
    "Gitgit",
    "Tegallinggah",
    "Panji",
    "Sukasada",
    "Wanagiri",
    "Selat",
    "Kayu Putih",
    "Padang Bulia",
    "Pancasari",
    "Silangjana",
    "Panji Anom",
    "Pegadungan",
    "Sambangan"
  ],
  villageCodeByVillage: {
    Ambengan: "B",
    Pegayaman: "B1",
    Gitgit: "B2",
    Tegallinggah: "B3",
    Panji: "B4",
    Sukasada: "B5",
    Wanagiri: "B6",
    Selat: "B7",
    "Kayu Putih": "B8",
    "Padang Bulia": "B9",
    Pancasari: "B10",
    Silangjana: "B11",
    "Panji Anom": "B12",
    Pegadungan: "B13",
    Sambangan: "B14"
  },
  villageReportNumberByVillage: {
    Ambengan: 1,
    Pegayaman: 2,
    Gitgit: 3,
    Tegallinggah: 4,
    Panji: 5,
    Sukasada: 6,
    Wanagiri: 7,
    Selat: 8,
    "Kayu Putih": 9,
    "Padang Bulia": 10,
    Pancasari: 11,
    "Panji Anom": 12,
    Pegadungan: 13,
    Sambangan: 14,
    Silangjana: 15
  },
  desaList: [
    "Gitgit",
    "Panji",
    "Panji Anom",
    "Pancasari",
    "Wanagiri",
    "Ambengan",
    "Kayu Putih",
    "Padang Bulia",
    "Pegadungan",
    "Pegayaman",
    "Sambangan",
    "Selat",
    "Silangjana",
    "Tegallinggah"
  ],
  kelurahanList: ["Sukasada"],
  babinsaByVillage: {
    Gitgit: {
      name: "Putu Agus Semaredana",
      rank: "Koptu",
      nrp: "31050476370584"
    },
    Wanagiri: {
      name: "Made Suradnya",
      rank: "Peltu",
      nrp: "21020221891282"
    },
    Pancasari: {
      name: "Ketut Serangan",
      rank: "Peltu",
      nrp: "21990160780377"
    },
    Selat: {
      name: "Jasman",
      rank: "Koptu",
      nrp: "31071130800486"
    },
    "Kayu Putih": {
      name: "Made Ariasa",
      rank: "Sertu",
      nrp: "31010733970780"
    },
    "Silangjana": {
      name: "Mujiburahman",
      rank: "Serma",
      nrp: "31950281580675"
    },
    Ambengan: {
      name: "I Made Widiasa",
      rank: "Serma",
      nrp: "31960756951076"
    },
    Pegayaman: {
      name: "Satriyo",
      rank: "Serka",
      nrp: "31980544820976"
    },
    Pegadungan: {
      name: "I Nyoman Arta",
      rank: "Serka",
      nrp: "31000305130479"
    },
    Tegallinggah: {
      name: "Wahyu Hidayat",
      rank: "Serma",
      nrp: "31980669730377"
    },
    Panji: {
      name: "I Komang Karia",
      rank: "Pelda",
      nrp: "31930571420673"
    },
    Sambangan: {
      name: "Nyoman Warsa",
      rank: "Sertu",
      nrp: "31060412250685"
    },
    "Panji Anom": {
      name: "I Kadek Teges Suardana",
      rank: "Serma",
      nrp: "31950282991075"
    },
    "Padang Bulia": {
      name: "I Putu Suwidana Yasa",
      rank: "Serda",
      nrp: "31010752020182"
    },
    Sukasada: {
      name: "Nyoman Join Amitaba",
      rank: "Serka",
      nrp: "31030330190583"
    }
  }
};

// Turn the former all-in-one ZIP control into a date-aware JSON uploader.
document.addEventListener("DOMContentLoaded", () => {
  const uploadButton = document.getElementById("upload-zip-button");
  const monthSelect = document.getElementById("report-month");
  const yearSelect = document.getElementById("report-year");
  const villageSelect = document.getElementById("report-village");
  const photoStatus = document.getElementById("photo-status");
  const warningDialog = document.getElementById("selection-warning-dialog");
  const warningTitle = document.getElementById("selection-warning-title");
  const warningMessage = document.getElementById("selection-warning-message");
  if (!uploadButton || !monthSelect || !yearSelect || !villageSelect) return;

  uploadButton.textContent = "Unggah JSON Kegiatan (berdasarkan tanggal)";
  uploadButton.setAttribute("aria-label", "Unggah file JSON kegiatan untuk mengatur tanggal dan desa laporan");
  const jsonInput = document.createElement("input");
  jsonInput.type = "file";
  jsonInput.accept = ".json,application/json";
  jsonInput.hidden = true;
  jsonInput.setAttribute("aria-label", "Pilih file JSON data kegiatan");
  document.body.append(jsonInput);

  const monthNames = [
    "Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"
  ];

  function showJsonMessage(title, message) {
    if (!warningDialog || warningDialog.open) return;
    warningTitle.textContent = title;
    warningMessage.textContent = message;
    warningDialog.showModal();
  }

  function parseIndonesianDate(value) {
    if (typeof value !== "string") return null;
    const match = value.trim().match(/^(\d{1,2})\s+([\p{L}]+)\s+(\d{4})$/u);
    if (!match) return null;
    const monthIndex = monthNames.findIndex((month) =>
      month.toLocaleLowerCase("id-ID") === match[2].toLocaleLowerCase("id-ID")
    );
    const day = Number(match[1]);
    const year = Number(match[3]);
    if (monthIndex < 0 || day < 1 || day > new Date(year, monthIndex + 1, 0).getDate()) return null;
    return { day, monthIndex, year };
  }

  uploadButton.addEventListener("click", () => {
    jsonInput.value = "";
    jsonInput.click();
  });

  jsonInput.addEventListener("change", async () => {
    const file = jsonInput.files?.[0];
    if (!file) return;

    try {
      const records = JSON.parse(await file.text());
      if (!Array.isArray(records) || records.length === 0) {
        throw new Error("Isi file harus berupa array JSON berisi minimal satu data kegiatan.");
      }

      const normalized = records.map((record, index) => {
        if (!record || typeof record !== "object" || Array.isArray(record)) {
          throw new Error(`Data nomor ${index + 1} bukan objek JSON yang valid.`);
        }
        const date = parseIndonesianDate(record.tanggal);
        if (!date || typeof record.nama_desa !== "string" || !record.nama_desa.trim() ||
            typeof record.koordinat !== "string" || !record.koordinat.trim() ||
            typeof record.waktu !== "string" || !record.waktu.trim()) {
          throw new Error(`Data nomor ${index + 1} wajib memiliki koordinat, nama_desa, tanggal (contoh: 05 November 2026), dan waktu.`);
        }
        return { ...record, nama_desa: record.nama_desa.trim(), date };
      });

      const first = normalized[0];
      const matchesFirstPeriod = (record) =>
        record.nama_desa.toLocaleLowerCase("id-ID") === first.nama_desa.toLocaleLowerCase("id-ID") &&
        record.date.monthIndex === first.date.monthIndex && record.date.year === first.date.year;
      if (!normalized.every(matchesFirstPeriod)) {
        throw new Error("Semua data dalam satu file JSON harus memiliki desa, bulan, dan tahun yang sama.");
      }

      const villageOption = Array.from(villageSelect.options).find((option) =>
        option.value.toLocaleLowerCase("id-ID") === first.nama_desa.toLocaleLowerCase("id-ID")
      );
      if (!villageOption) throw new Error(`Desa/kelurahan '${first.nama_desa}' tidak tersedia di daftar laporan.`);

      const yearValue = String(first.date.year);
      if (!Array.from(yearSelect.options).some((option) => option.value === yearValue)) {
        const option = document.createElement("option");
        option.value = yearValue;
        option.textContent = yearValue;
        yearSelect.append(option);
      }

      monthSelect.value = String(first.date.monthIndex);
      yearSelect.value = yearValue;
      villageSelect.value = villageOption.value;
      monthSelect.classList.toggle("has-selection", true);
      yearSelect.classList.toggle("has-selection", true);
      villageSelect.classList.toggle("has-selection", true);
      if (typeof updateReportPeriod === "function") updateReportPeriod();
      if (typeof updateBabinsa === "function") updateBabinsa();
      if (typeof updateSelectionStyles === "function") updateSelectionStyles();
      if (typeof window.applyVillage === "function") window.applyVillage(villageOption.value);
      if (typeof loadPhotosFromSelectedVillage === "function") loadPhotosFromSelectedVillage();

      const dateLabel = `${String(first.date.day).padStart(2, "0")} ${monthNames[first.date.monthIndex]} ${first.date.year}`;
      const info = `${records.length} data JSON dimuat untuk ${first.nama_desa}, ${dateLabel}. Foto laporan akan mengikuti desa dan periode tersebut.`;
      if (photoStatus) photoStatus.textContent = info;
      showJsonMessage("JSON berhasil dimuat", info);
    } catch (error) {
      showJsonMessage("File JSON tidak dapat dimuat", error.message || "Pastikan format JSON sesuai contoh.");
    }
  });
});
