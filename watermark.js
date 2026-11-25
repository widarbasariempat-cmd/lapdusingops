(() => {
  const style = document.createElement("style");
  style.textContent = `
    .photo-watermark {
      position: absolute;
      z-index: 1;
      top: 50%;
      left: 50%;
      width: calc(100% - 24px);
      max-height: calc(100% - 24px);
      overflow: hidden;
      transform: translate(-50%, -50%);
      color: rgba(255, 255, 255, 0.9);
      font: 700 12pt/1.3 Arial, Helvetica, sans-serif;
      text-align: center;
      overflow-wrap: anywhere;
      pointer-events: none;
      text-shadow: 0 1px 2px rgba(0, 0, 0, 0.9), 0 0 5px rgba(0, 0, 0, 0.65);
    }
  `;
  document.head.append(style);

  const slots = Array.from(document.querySelectorAll(".photo-slot"));
  const updateWatermarks = () => {
    const activities = Array.from(
      document.querySelectorAll(".budget-table tbody tr")
    ).map((row) => row.cells[2]?.textContent.trim() || "");

    slots.forEach((slot, index) => {
      let watermark = slot.querySelector(".photo-watermark");
      if (!watermark) {
        watermark = document.createElement("span");
        watermark.className = "photo-watermark";
        watermark.setAttribute("aria-hidden", "true");
        slot.append(watermark);
      }
      const text = activities[index] || "";
      if (watermark.textContent !== text) watermark.textContent = text;
    });
  };

  updateWatermarks();
  const budgetDocument = document.querySelector("#budget-document");
  if (budgetDocument) {
    new MutationObserver(updateWatermarks).observe(budgetDocument, {
      childList: true,
      characterData: true,
      subtree: true
    });
  }
})();
