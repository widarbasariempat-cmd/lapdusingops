(() => {
  const processedDataUrls = new WeakSet();

  function selectedWatermarkLines() {
    const village = document.querySelector("#report-village")?.value;
    const monthSelect = document.querySelector("#report-month");
    const year = document.querySelector("#report-year")?.value;
    const month = monthSelect?.selectedOptions?.[0]?.textContent?.trim();
    if (!village || !month || !year) return null;

    const displayVillage = village.toLocaleLowerCase("id-ID") === "sukasada"
      ? "Babinsa Kelurahan Sukasada"
      : `Babinsa ${village}`;
    return [displayVillage, `Bulan ${month} ${year}`];
  }

  function addTextWatermark(image) {
    if (!(image instanceof HTMLImageElement) || !image.classList.contains("photo-preview")) return;
    if (image.dataset.watermarkBusy || processedDataUrls.has(image.currentSrc || image.src)) return;

    const lines = selectedWatermarkLines();
    if (!lines || !image.naturalWidth || !image.naturalHeight) return;

    const maxSide = 2800;
    const scale = Math.min(1, maxSide / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) return;

    try {
      context.fillStyle = "#fff";
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(image, 0, 0, canvas.width, canvas.height);

      const fontSize = Math.max(16, Math.min(42, canvas.width * 0.042));
      const lineHeight = fontSize * 1.25;
      const right = canvas.width * 0.025;
      const bottom = canvas.height * 0.035;
      context.textAlign = "right";
      context.textBaseline = "bottom";
      context.font = `700 ${fontSize}px Arial, Helvetica, sans-serif`;
      context.lineJoin = "round";
      context.lineWidth = Math.max(2, fontSize * 0.12);
      context.strokeStyle = "rgba(0, 0, 0, 0.85)";
      context.fillStyle = "#fff";
      context.shadowColor = "rgba(0, 0, 0, 0.8)";
      context.shadowBlur = fontSize * 0.25;
      context.shadowOffsetX = fontSize * 0.06;
      context.shadowOffsetY = fontSize * 0.06;

      lines.forEach((line, index) => {
        const y = canvas.height - bottom - (lines.length - 1 - index) * lineHeight;
        context.strokeText(line, canvas.width - right, y);
        context.fillText(line, canvas.width - right, y);
      });

      const watermarkedUrl = canvas.toDataURL("image/jpeg", 0.92);
      processedDataUrls.add(watermarkedUrl);
      image.dataset.watermarkBusy = "true";
      const originalOnload = image.onload;
      image.hidden = true;
      image.onload = function (event) {
        image.onload = originalOnload;
        delete image.dataset.watermarkBusy;
        if (typeof originalOnload === "function") originalOnload.call(image, event);
        else image.hidden = false;
      };
      image.src = watermarkedUrl;
    } catch (error) {
      // If the source is cross-origin or cannot be drawn, keep the original photo usable.
      console.warn("Watermark foto dilewati:", error);
    }
  }

  // Intercept successful preview image loads so the original onload status logic
  // runs only after the watermarked image has finished loading.
  document.addEventListener("load", (event) => {
    const image = event.target;
    if (!(image instanceof HTMLImageElement) || !image.classList.contains("photo-preview")) return;
    if (processedDataUrls.has(image.currentSrc || image.src)) return;

    const sourceOnload = image.onload;
    image.onload = null;
    addTextWatermark(image);
    if (image.dataset.watermarkBusy) {
      event.stopImmediatePropagation();
      return;
    }
    image.onload = sourceOnload;
  }, true);
})();
