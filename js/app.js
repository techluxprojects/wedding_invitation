(function () {
  var TITLE_OPTIONS = [
    "MR",
    "MRS",
    "MS",
    "MISS",
    "MASTER",
    "DR",
    "REV",
    "VEN",
    "MR & MRS",
    "MR & MRS & FAMILY",
    "FAMILY",
  ];

  function sanitizeText(value) {
    return String(value || "")
      .replace(/\s+/g, " ")
      .trim();
  }

  function normalizeTitle(value) {
    return sanitizeText(value)
      .replace(/\s*\.\s*/g, "")
      .toUpperCase();
  }

  function toTitleCase(value) {
    return sanitizeText(value).replace(
      /\b([A-Za-z])([A-Za-z]*)/g,
      function (_, first, rest) {
        return first.toUpperCase() + rest.toLowerCase();
      },
    );
  }

  function formatGuestName(title, name) {
    var normalizedTitle = normalizeTitle(title);
    var normalizedName = toTitleCase(name);
    var displayTitle = sanitizeText(title);

    if (!normalizedName) {
      return "";
    }

    if (normalizedTitle === "FAMILY") {
      return (displayTitle || "FAMILY") + " " + normalizedName;
    }

    if (normalizedTitle === "MR & MRS & FAMILY") {
      return "MR & MRS . " + normalizedName + " & FAMILY";
    }

    if (TITLE_OPTIONS.indexOf(normalizedTitle) === -1) {
      return normalizedName;
    }

    return displayTitle + " " + normalizedName;
  }

  function safeFilenamePart(value) {
    return sanitizeText(value)
      .replace(/&/g, " AND ")
      .replace(/[^A-Za-z0-9\s-]/g, "")
      .replace(/\s+/g, "_")
      .replace(/_+/g, "_")
      .replace(/^_+|_+$/g, "");
  }

  function generateSafeFilename(type, title, name) {
    var typePart = safeFilenamePart(type || "invitation").toLowerCase();
    var titlePart = safeFilenamePart(title || "");
    var namePart = safeFilenamePart(name || "");
    var parts = [typePart];

    if (titlePart) {
      parts.push(titlePart);
    }

    if (namePart) {
      parts.push(namePart);
    }

    return parts.join("_") + ".pdf";
  }

  function updatePreviewText(config) {
    var formattedName = formatGuestName(
      config.titleInput.value,
      config.nameInput.value,
    );
    config.nameOutput.textContent = formattedName;

    if (config.tableOutput && config.tableInput) {
      config.tableOutput.textContent = sanitizeText(config.tableInput.value);
    }
  }

  function loadScript(url) {
    return new Promise(function (resolve, reject) {
      var script = document.createElement("script");

      script.src = url;
      script.async = true;
      script.onload = resolve;
      script.onerror = function () {
        reject(new Error("Failed to load script: " + url));
      };

      document.head.appendChild(script);
    });
  }

  function getJsPdf() {
    if (window.jspdf && typeof window.jspdf.jsPDF === "function") {
      return Promise.resolve(window.jspdf.jsPDF);
    }

    return loadScript(
      "https://unpkg.com/jspdf@2.5.1/dist/jspdf.umd.min.js",
    ).then(function () {
      if (!window.jspdf || typeof window.jspdf.jsPDF !== "function") {
        throw new Error("jsPDF did not initialize correctly.");
      }

      return window.jspdf.jsPDF;
    });
  }

  function getHtml2Canvas() {
    if (typeof window.html2canvas === "function") {
      return Promise.resolve(window.html2canvas);
    }

    return loadScript(
      "https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js",
    ).then(function () {
      if (typeof window.html2canvas !== "function") {
        throw new Error("html2canvas did not initialize correctly.");
      }

      return window.html2canvas;
    });
  }

  async function buildInvitationCanvas(config) {
    var html2canvas;
    var pixelRatio;

    await document.fonts.ready;
    html2canvas = await getHtml2Canvas();
    pixelRatio = Math.max(window.devicePixelRatio || 1, 2);

    return html2canvas(config.previewRoot, {
      backgroundColor: "#ffffff",
      useCORS: true,
      scale: pixelRatio,
      logging: false,
    });
  }

  async function downloadPDF(config) {
    var guestName = sanitizeText(config.nameInput.value);
    var JsPdf;
    var canvas;

    if (!guestName) {
      window.alert("Please enter guest name.");
      return;
    }

    updatePreviewText(config);

    JsPdf = await getJsPdf();
    canvas = await buildInvitationCanvas(config);

    var imageData = canvas.toDataURL("image/png");
    var pdf = new JsPdf({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });
    var pageWidth = pdf.internal.pageSize.getWidth();
    var pageHeight = pdf.internal.pageSize.getHeight();
    var cardRatio = canvas.width / canvas.height;
    var renderWidth = pageWidth;
    var renderHeight = renderWidth / cardRatio;

    if (renderHeight > pageHeight) {
      renderHeight = pageHeight;
      renderWidth = renderHeight * cardRatio;
    }

    var x = (pageWidth - renderWidth) / 2;
    var y = (pageHeight - renderHeight) / 2;

    pdf.addImage(
      imageData,
      "PNG",
      x,
      y,
      renderWidth,
      renderHeight,
      undefined,
      "FAST",
    );
    pdf.save(
      generateSafeFilename(
        config.previewRoot.dataset.filenamePrefix,
        config.titleInput.value,
        guestName,
      ),
    );
  }

  function initInvitationPage() {
    var previewRoot = document.querySelector("[data-preview-root]");
    var form = document.querySelector("[data-invitation-form]");

    if (!previewRoot || !form) {
      return;
    }

    var config = {
      previewRoot: previewRoot,
      titleInput: form.querySelector('[data-field="title"]'),
      nameInput: form.querySelector('[data-field="name"]'),
      tableInput: form.querySelector('[data-field="table"]'),
      nameOutput: previewRoot.querySelector("[data-preview-name]"),
      tableOutput: previewRoot.querySelector("[data-preview-table]"),
      downloadButton: document.querySelector("[data-download-pdf]"),
    };

    var syncPreview = function () {
      updatePreviewText(config);
    };

    config.titleInput.addEventListener("change", syncPreview);
    config.nameInput.addEventListener("input", syncPreview);

    if (config.tableInput) {
      config.tableInput.addEventListener("input", syncPreview);
    }

    config.downloadButton.addEventListener("click", function () {
      downloadPDF(config).catch(function (error) {
        console.error("PDF generation failed:", error);
        window.alert("Unable to generate PDF. Please try again.");
      });
    });

    syncPreview();
  }

  window.formatGuestName = formatGuestName;
  window.generateSafeFilename = generateSafeFilename;
  window.updateInvitationPreview = updatePreviewText;
  window.downloadInvitationPDF = downloadPDF;

  document.addEventListener("DOMContentLoaded", initInvitationPage);
})();
