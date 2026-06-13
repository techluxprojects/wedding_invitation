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

  function loadImage(url) {
    return new Promise(function (resolve, reject) {
      var image = new Image();

      if (/^https?:\/\//i.test(url)) {
        image.crossOrigin = "anonymous";
      }

      image.onload = function () {
        resolve(image);
      };
      image.onerror = function () {
        reject(new Error("Failed to load image: " + url));
      };
      image.src = url;
    });
  }

  function wrapTextLines(context, text, maxWidth) {
    var words = sanitizeText(text).split(" ");
    var lines = [];
    var currentLine = "";

    if (!words[0]) {
      return lines;
    }

    words.forEach(function (word) {
      var nextLine = currentLine ? currentLine + " " + word : word;

      if (
        currentLine &&
        context.measureText(nextLine).width > maxWidth
      ) {
        lines.push(currentLine);
        currentLine = word;
        return;
      }

      currentLine = nextLine;
    });

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  function drawCenteredTextBlock(context, options) {
    var lines = wrapTextLines(context, options.text, options.maxWidth);
    var lineHeight = options.fontSize * options.lineHeight;
    var longestLineWidth = 0;
    var startY;

    if (!lines.length) {
      return;
    }

    lines.forEach(function (line) {
      longestLineWidth = Math.max(
        longestLineWidth,
        context.measureText(line).width,
      );
    });

    startY =
      options.top +
      options.fontSize +
      ((lines.length - 1) * lineHeight) / -2;

    lines.forEach(function (line, index) {
      context.fillText(line, options.centerX, startY + index * lineHeight);
    });

    context.beginPath();
    context.moveTo(options.centerX - longestLineWidth / 2, startY + lines.length * lineHeight);
    context.lineTo(options.centerX + longestLineWidth / 2, startY + lines.length * lineHeight);
    context.lineWidth = options.underlineWidth;
    context.strokeStyle = options.underlineColor;
    context.stroke();
  }

  async function buildInvitationCanvas(config) {
    var imageElement = config.previewRoot.querySelector("img");
    var invitationType = config.previewRoot.dataset.invitationType;
    var tableValue = config.tableInput ? sanitizeText(config.tableInput.value) : "";
    var backgroundImage;
    var canvas;
    var context;
    var text;
    var centerX = 620;

    if (!imageElement) {
      throw new Error("Invitation background image not found.");
    }

    await document.fonts.ready;
    backgroundImage = await loadImage(imageElement.currentSrc || imageElement.src);

    canvas = document.createElement("canvas");
    canvas.width = backgroundImage.naturalWidth || 1240;
    canvas.height = backgroundImage.naturalHeight || 1748;
    context = canvas.getContext("2d");

    context.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
    context.textAlign = "center";
    context.textBaseline = "alphabetic";
    text = formatGuestName(config.titleInput.value, config.nameInput.value);

    if (invitationType === "homecoming") {
      context.fillStyle = "#71716f";
      context.font = "italic 600 42px 'Cormorant Garamond', serif";

      drawCenteredTextBlock(context, {
        text: text,
        centerX: centerX,
        top: canvas.height * 0.58,
        maxWidth: canvas.width * 0.822,
        fontSize: 42,
        lineHeight: 1.18,
        underlineWidth: 1.5,
        underlineColor: "rgba(121, 112, 85, 0.62)",
      });

      return canvas;
    }

    context.fillStyle = "#4f5749";
    context.font = "600 35px 'Cormorant Garamond', serif";

    drawCenteredTextBlock(context, {
      text: text,
      centerX: centerX,
      top: canvas.height * 0.4725,
      maxWidth: canvas.width * 0.76,
      fontSize: 35,
      lineHeight: 1.18,
      underlineWidth: 1.5,
      underlineColor: "rgba(121, 112, 85, 0.62)",
    });

    if (tableValue) {
      context.fillStyle = "#7b6d4b";
      context.font = "700 24px 'Cormorant Garamond', serif";
      context.fillText(tableValue, canvas.width * 0.568, canvas.height * 0.842);
    }

    return canvas;
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
