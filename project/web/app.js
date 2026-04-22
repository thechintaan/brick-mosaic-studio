const storageKey = "lego-mosaic-maker-projects-v1";
const state = {
  projects: [],
  activeProjectId: null,
  activeMosaicId: null,
  originalImage: null,
  originalImageDataUrl: "",
  renderSettings: {
    preset: "original",
    density: 52,
    smoothing: 24,
    sizePreset: "a5",
    customWidthMm: 148,
    customHeightMm: 210,
    dpi: 300,
  },
  renderResult: null,
};

const sizePresets = {
  a5: { label: "A5 Portrait", widthMm: 148, heightMm: 210 },
  a4: { label: "A4 Portrait", widthMm: 210, heightMm: 297 },
  "a4-landscape": { label: "A4 Landscape", widthMm: 297, heightMm: 210 },
  "4x6": { label: "4x6 Photo", widthMm: 102, heightMm: 152 },
};

const presetPalettes = {
  original: null,
  bw: [
    { name: "White", hex: "#f5f4ef" },
    { name: "Light Gray", hex: "#cfcbc4" },
    { name: "Dark Gray", hex: "#706d67" },
    { name: "Black", hex: "#1e1d1b" },
  ],
  retro: [
    { name: "Cream", hex: "#f5e6c8" },
    { name: "Ochre", hex: "#d59a52" },
    { name: "Brick Red", hex: "#bb5a3f" },
    { name: "Dusty Rose", hex: "#d8827f" },
    { name: "Olive", hex: "#6d7c50" },
    { name: "Teal", hex: "#4d7f82" },
    { name: "Navy", hex: "#2a4363" },
    { name: "Espresso", hex: "#4f3426" },
  ],
};

const els = {
  imageUpload: document.getElementById("imageUpload"),
  previewCanvas: document.getElementById("previewCanvas"),
  presetSelect: document.getElementById("presetSelect"),
  densityRange: document.getElementById("densityRange"),
  densityLabel: document.getElementById("densityLabel"),
  smoothingRange: document.getElementById("smoothingRange"),
  smoothingLabel: document.getElementById("smoothingLabel"),
  sizePresetSelect: document.getElementById("sizePresetSelect"),
  customWidthInput: document.getElementById("customWidthInput"),
  customHeightInput: document.getElementById("customHeightInput"),
  dpiSelect: document.getElementById("dpiSelect"),
  renderButton: document.getElementById("renderButton"),
  downloadButton: document.getElementById("downloadButton"),
  shareButton: document.getElementById("shareButton"),
  paletteLabel: document.getElementById("paletteLabel"),
  brickCountLabel: document.getElementById("brickCountLabel"),
  exportSizeLabel: document.getElementById("exportSizeLabel"),
  statusLabel: document.getElementById("statusLabel"),
  projectNameInput: document.getElementById("projectNameInput"),
  newProjectButton: document.getElementById("newProjectButton"),
  projectList: document.getElementById("projectList"),
  mosaicNameInput: document.getElementById("mosaicNameInput"),
  saveMosaicButton: document.getElementById("saveMosaicButton"),
  mosaicList: document.getElementById("mosaicList"),
  recipeList: document.getElementById("recipeList"),
  projectItemTemplate: document.getElementById("projectItemTemplate"),
  mosaicItemTemplate: document.getElementById("mosaicItemTemplate"),
};

function init() {
  bindEvents();
  loadProjects();

  if (!state.projects.length) {
    createProject("Starter Project");
  }

  syncControlsFromSettings();
  updateProjectList();
  updateMosaicList();
  renderRecipe();
  updateStats();
  drawEmptyState();
}

function bindEvents() {
  els.imageUpload.addEventListener("change", onImageUpload);
  els.presetSelect.addEventListener("change", () => {
    state.renderSettings.preset = els.presetSelect.value;
    renderCurrentMosaic();
  });
  els.densityRange.addEventListener("input", () => {
    state.renderSettings.density = Number(els.densityRange.value);
    els.densityLabel.textContent = `${state.renderSettings.density} studs across`;
  });
  els.densityRange.addEventListener("change", renderCurrentMosaic);
  els.smoothingRange.addEventListener("input", () => {
    state.renderSettings.smoothing = Number(els.smoothingRange.value);
    els.smoothingLabel.textContent = `${state.renderSettings.smoothing}% tonal smoothing`;
  });
  els.smoothingRange.addEventListener("change", renderCurrentMosaic);
  els.sizePresetSelect.addEventListener("change", onSizePresetChange);
  els.customWidthInput.addEventListener("change", onCustomSizeChange);
  els.customHeightInput.addEventListener("change", onCustomSizeChange);
  els.dpiSelect.addEventListener("change", () => {
    state.renderSettings.dpi = Number(els.dpiSelect.value);
    updateExportLabel();
  });
  els.renderButton.addEventListener("click", renderCurrentMosaic);
  els.downloadButton.addEventListener("click", downloadCurrentMosaic);
  els.shareButton.addEventListener("click", shareCurrentMosaic);
  els.newProjectButton.addEventListener("click", () => createProject(els.projectNameInput.value.trim() || undefined));
  els.saveMosaicButton.addEventListener("click", saveCurrentMosaic);
}

function onSizePresetChange() {
  state.renderSettings.sizePreset = els.sizePresetSelect.value;
  if (state.renderSettings.sizePreset !== "custom") {
    const preset = sizePresets[state.renderSettings.sizePreset];
    state.renderSettings.customWidthMm = preset.widthMm;
    state.renderSettings.customHeightMm = preset.heightMm;
    syncControlsFromSettings();
  }
  updateExportLabel();
}

function onCustomSizeChange() {
  state.renderSettings.sizePreset = "custom";
  state.renderSettings.customWidthMm = Number(els.customWidthInput.value) || 148;
  state.renderSettings.customHeightMm = Number(els.customHeightInput.value) || 210;
  els.sizePresetSelect.value = "custom";
  updateExportLabel();
}

async function onImageUpload(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  const dataUrl = await readFileAsDataUrl(file);
  const optimizedDataUrl = await downscaleDataUrl(dataUrl, 1600);
  const image = await loadImage(optimizedDataUrl);
  state.originalImage = image;
  state.originalImageDataUrl = optimizedDataUrl;
  setStatus("Photo ready. Rendering mosaic...");
  renderCurrentMosaic();
}

function renderCurrentMosaic() {
  if (!state.originalImage) {
    setStatus("Upload a photo to render a mosaic.");
    return;
  }

  const density = state.renderSettings.density;
  const source = buildSourceGrid(state.originalImage, density, state.renderSettings.smoothing / 100);
  const palette = resolvePalette(state.renderSettings.preset);
  const mapped = mapCellsToPalette(source.cells, palette, state.renderSettings.preset);
  const recipe = buildRecipe(mapped.cells);
  state.renderResult = {
    ...mapped,
    sourceWidth: source.width,
    sourceHeight: source.height,
    recipe,
  };
  drawPreview();
  renderRecipe();
  updateStats();
  setStatus(`Rendered ${mapped.cells.length} bricks.`);
}

function buildSourceGrid(image, targetStudsAcross, smoothingAmount) {
  const aspectRatio = image.height / image.width;
  const width = targetStudsAcross;
  const height = Math.max(1, Math.round(width * aspectRatio));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.imageSmoothingEnabled = true;
  ctx.filter = `blur(${(smoothingAmount * 1.4).toFixed(2)}px) saturate(${(1 - smoothingAmount * 0.18).toFixed(2)})`;
  ctx.drawImage(image, 0, 0, width, height);
  const { data } = ctx.getImageData(0, 0, width, height);
  const cells = [];

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const index = (y * width + x) * 4;
      cells.push({
        x,
        y,
        r: data[index],
        g: data[index + 1],
        b: data[index + 2],
        a: data[index + 3],
      });
    }
  }

  return { width, height, cells };
}

function resolvePalette(preset) {
  if (preset === "original") {
    return null;
  }

  return presetPalettes[preset].map((color) => ({
    ...color,
    rgb: hexToRgb(color.hex),
  }));
}

function mapCellsToPalette(cells, palette, preset) {
  const mappedCells = cells.map((cell) => {
    let rgb = { r: cell.r, g: cell.g, b: cell.b };

    if (preset === "bw") {
      const gray = Math.round(cell.r * 0.299 + cell.g * 0.587 + cell.b * 0.114);
      rgb = { r: gray, g: gray, b: gray };
    } else if (preset === "retro") {
      rgb = applyRetroTone(rgb);
    }

    if (!palette) {
      return {
        ...cell,
        color: rgbToHex(rgb),
        name: "Sampled Color",
      };
    }

    const nearest = palette.reduce((best, candidate) => {
      const distance = colorDistance(rgb, candidate.rgb);
      return distance < best.distance ? { candidate, distance } : best;
    }, { candidate: palette[0], distance: Number.POSITIVE_INFINITY }).candidate;

    return {
      ...cell,
      color: nearest.hex,
      name: nearest.name,
    };
  });

  return { cells: mappedCells };
}

function applyRetroTone(rgb) {
  const warm = {
    r: Math.min(255, rgb.r * 1.04 + 12),
    g: Math.min(255, rgb.g * 0.97 + 6),
    b: Math.max(0, rgb.b * 0.84),
  };

  return {
    r: Math.round(warm.r),
    g: Math.round(warm.g),
    b: Math.round(warm.b),
  };
}

function buildRecipe(cells) {
  const counts = new Map();
  cells.forEach((cell) => {
    const key = `${cell.name}__${cell.color}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });

  return [...counts.entries()]
    .map(([key, count]) => {
      const [name, color] = key.split("__");
      return { name, color, count };
    })
    .sort((a, b) => b.count - a.count);
}

function drawPreview() {
  const ctx = els.previewCanvas.getContext("2d");
  const width = els.previewCanvas.width;
  const height = els.previewCanvas.height;
  ctx.clearRect(0, 0, width, height);

  if (!state.renderResult) {
    drawEmptyState();
    return;
  }

  drawMosaicToContext(ctx, state.renderResult, width, height, 36);
}

function drawMosaicToContext(ctx, renderResult, width, height, padding) {
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = "#f8f2e8";
  ctx.fillRect(0, 0, width, height);

  const gridWidth = renderResult.sourceWidth;
  const gridHeight = renderResult.sourceHeight;
  const tileSize = Math.min((width - padding * 2) / gridWidth, (height - padding * 2) / gridHeight);
  const offsetX = (width - tileSize * gridWidth) / 2;
  const offsetY = (height - tileSize * gridHeight) / 2;

  renderResult.cells.forEach((cell) => {
    const x = offsetX + cell.x * tileSize;
    const y = offsetY + cell.y * tileSize;
    drawBrick(ctx, x, y, tileSize, cell.color);
  });
}

function drawBrick(ctx, x, y, size, color) {
  const bevel = size * 0.1;
  const studRadius = Math.max(2, size * 0.18);
  const studX = x + size / 2;
  const studY = y + size / 2;
  const base = hexToRgb(color);
  const light = shiftColor(base, 22);
  const dark = shiftColor(base, -18);

  ctx.fillStyle = color;
  roundRect(ctx, x, y, size, size, Math.max(2, size * 0.15));
  ctx.fill();

  ctx.fillStyle = `rgba(${light.r}, ${light.g}, ${light.b}, 0.45)`;
  roundRect(ctx, x + bevel * 0.35, y + bevel * 0.35, size - bevel * 0.7, bevel, bevel / 2);
  ctx.fill();

  const gradient = ctx.createRadialGradient(studX - studRadius * 0.4, studY - studRadius * 0.5, studRadius * 0.25, studX, studY, studRadius * 1.2);
  gradient.addColorStop(0, `rgba(${light.r}, ${light.g}, ${light.b}, 0.95)`);
  gradient.addColorStop(1, `rgba(${dark.r}, ${dark.g}, ${dark.b}, 0.92)`);
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(studX, studY, studRadius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(${dark.r}, ${dark.g}, ${dark.b}, 0.45)`;
  ctx.lineWidth = Math.max(1, size * 0.04);
  ctx.stroke();
}

function drawEmptyState() {
  const ctx = els.previewCanvas.getContext("2d");
  ctx.clearRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);
  ctx.fillStyle = "#f8f2e8";
  ctx.fillRect(0, 0, els.previewCanvas.width, els.previewCanvas.height);

  ctx.fillStyle = "#b18a63";
  ctx.font = '600 42px "Avenir Next", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("Upload a photo to start building", els.previewCanvas.width / 2, els.previewCanvas.height / 2 - 10);
  ctx.font = '400 24px "Helvetica Neue", sans-serif';
  ctx.fillText("Your Lego-style mosaic preview will land here.", els.previewCanvas.width / 2, els.previewCanvas.height / 2 + 34);
}

function renderRecipe() {
  els.recipeList.innerHTML = "";
  if (!state.renderResult?.recipe?.length) {
    const empty = document.createElement("p");
    empty.className = "lede";
    empty.textContent = "Render a mosaic to see the brick recipe.";
    els.recipeList.append(empty);
    return;
  }

  state.renderResult.recipe.forEach((item) => {
    const row = document.createElement("div");
    row.className = "recipe-item";
    row.innerHTML = `
      <span class="swatch" style="background:${item.color}"></span>
      <span>${item.name}</span>
      <strong>${item.count}</strong>
    `;
    els.recipeList.append(row);
  });
}

function updateStats() {
  const presetLabels = {
    original: "Original Colors",
    bw: "Black & White",
    retro: "Retro",
  };
  els.paletteLabel.textContent = presetLabels[state.renderSettings.preset];
  els.brickCountLabel.textContent = state.renderResult ? state.renderResult.cells.length.toLocaleString() : "0";
  updateExportLabel();
}

function updateExportLabel() {
  const label = state.renderSettings.sizePreset === "custom"
    ? `${state.renderSettings.customWidthMm} x ${state.renderSettings.customHeightMm} mm`
    : sizePresets[state.renderSettings.sizePreset].label;

  els.exportSizeLabel.textContent = label;
}

function setStatus(message) {
  els.statusLabel.textContent = message;
}

function downloadCurrentMosaic() {
  if (!state.renderResult) {
    setStatus("Render a mosaic before downloading.");
    return;
  }

  const exportCanvas = renderExportCanvas();
  const link = document.createElement("a");
  const filename = `${slugify(getCurrentMosaicName()) || "lego-mosaic"}.png`;
  link.href = exportCanvas.toDataURL("image/png");
  link.download = filename;
  link.click();
  setStatus(`Downloaded ${filename}`);
}

async function shareCurrentMosaic() {
  if (!state.renderResult) {
    setStatus("Render a mosaic before sharing.");
    return;
  }

  const exportCanvas = renderExportCanvas();
  const dataUrl = exportCanvas.toDataURL("image/png");

  if (navigator.share && navigator.canShare) {
    const file = dataUrlToFile(dataUrl, `${slugify(getCurrentMosaicName()) || "lego-mosaic"}.png`);
    if (navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          title: getCurrentMosaicName(),
          text: "Check out this Lego-style mosaic I made.",
          files: [file],
        });
        setStatus("Shared mosaic.");
        return;
      } catch (error) {
        if (error.name !== "AbortError") {
          console.error(error);
        }
      }
    }
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(dataUrl);
      setStatus("PNG data URL copied to clipboard for quick sharing.");
      return;
    }
  } catch (error) {
    console.error(error);
  }

  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `${slugify(getCurrentMosaicName()) || "lego-mosaic"}-share.png`;
  link.click();
  setStatus("Browser share is unavailable, so a share-ready PNG was downloaded instead.");
}

function renderExportCanvas() {
  const { widthMm, heightMm } = getSelectedExportSize();
  const dpi = state.renderSettings.dpi;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round((widthMm / 25.4) * dpi);
  canvas.height = Math.round((heightMm / 25.4) * dpi);
  const ctx = canvas.getContext("2d");
  drawMosaicToContext(ctx, state.renderResult, canvas.width, canvas.height, Math.max(24, canvas.width * 0.03));
  return canvas;
}

function getSelectedExportSize() {
  if (state.renderSettings.sizePreset === "custom") {
    return {
      widthMm: state.renderSettings.customWidthMm,
      heightMm: state.renderSettings.customHeightMm,
    };
  }

  return sizePresets[state.renderSettings.sizePreset];
}

function saveCurrentMosaic() {
  const project = getActiveProject();
  if (!project) {
    setStatus("Create or select a project first.");
    return;
  }
  if (!state.originalImageDataUrl || !state.renderResult) {
    setStatus("Upload and render a photo before saving.");
    return;
  }

  const name = getCurrentMosaicName();
  const snapshot = els.previewCanvas.toDataURL("image/png");
  const mosaic = {
    id: state.activeMosaicId || createId("mosaic"),
    name,
    imageDataUrl: state.originalImageDataUrl,
    snapshotDataUrl: snapshot,
    renderSettings: { ...state.renderSettings },
    updatedAt: new Date().toISOString(),
  };

  const existingIndex = project.mosaics.findIndex((item) => item.id === mosaic.id);
  if (existingIndex >= 0) {
    project.mosaics[existingIndex] = mosaic;
  } else {
    project.mosaics.unshift(mosaic);
  }

  state.activeMosaicId = mosaic.id;
  persistProjects();
  updateMosaicList();
  setStatus(`Saved "${name}" to ${project.name}.`);
}

function createProject(name = `Project ${state.projects.length + 1}`) {
  const project = {
    id: createId("project"),
    name,
    mosaics: [],
    createdAt: new Date().toISOString(),
  };
  state.projects.unshift(project);
  state.activeProjectId = project.id;
  state.activeMosaicId = null;
  persistProjects();
  updateProjectList();
  updateMosaicList();
  els.projectNameInput.value = project.name;
  setStatus(`Created project "${project.name}".`);
}

function updateProjectList() {
  els.projectList.innerHTML = "";
  state.projects.forEach((project) => {
    const node = els.projectItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".title").textContent = project.name;
    node.querySelector(".meta").textContent = `${project.mosaics.length} mosaics`;
    node.classList.toggle("active", project.id === state.activeProjectId);
    node.addEventListener("click", () => {
      state.activeProjectId = project.id;
      state.activeMosaicId = null;
      els.projectNameInput.value = project.name;
      updateProjectList();
      updateMosaicList();
      setStatus(`Selected project "${project.name}".`);
    });
    els.projectList.append(node);
  });
}

function updateMosaicList() {
  els.mosaicList.innerHTML = "";
  const project = getActiveProject();
  if (!project || !project.mosaics.length) {
    const empty = document.createElement("p");
    empty.className = "lede";
    empty.textContent = "Saved mosaics in this project will show up here.";
    els.mosaicList.append(empty);
    return;
  }

  project.mosaics.forEach((mosaic) => {
    const node = els.mosaicItemTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector(".title").textContent = mosaic.name;
    node.querySelector(".meta").textContent = new Date(mosaic.updatedAt).toLocaleDateString();
    node.classList.toggle("active", mosaic.id === state.activeMosaicId);
    node.addEventListener("click", () => loadSavedMosaic(mosaic));
    els.mosaicList.append(node);
  });
}

async function loadSavedMosaic(mosaic) {
  state.activeMosaicId = mosaic.id;
  state.renderSettings = { ...mosaic.renderSettings };
  syncControlsFromSettings();
  state.originalImageDataUrl = mosaic.imageDataUrl;
  state.originalImage = await loadImage(mosaic.imageDataUrl);
  els.mosaicNameInput.value = mosaic.name;
  updateMosaicList();
  renderCurrentMosaic();
  setStatus(`Loaded "${mosaic.name}".`);
}

function loadProjects() {
  try {
    state.projects = JSON.parse(localStorage.getItem(storageKey) || "[]");
    state.activeProjectId = state.projects[0]?.id || null;
  } catch (error) {
    console.error(error);
    state.projects = [];
  }
}

function persistProjects() {
  localStorage.setItem(storageKey, JSON.stringify(state.projects));
}

function syncControlsFromSettings() {
  els.presetSelect.value = state.renderSettings.preset;
  els.densityRange.value = state.renderSettings.density;
  els.densityLabel.textContent = `${state.renderSettings.density} studs across`;
  els.smoothingRange.value = state.renderSettings.smoothing;
  els.smoothingLabel.textContent = `${state.renderSettings.smoothing}% tonal smoothing`;
  els.sizePresetSelect.value = state.renderSettings.sizePreset;
  els.customWidthInput.value = state.renderSettings.customWidthMm;
  els.customHeightInput.value = state.renderSettings.customHeightMm;
  els.dpiSelect.value = String(state.renderSettings.dpi);
  updateExportLabel();
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId);
}

function getCurrentMosaicName() {
  return els.mosaicNameInput.value.trim() || "Fresh Mosaic";
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = src;
  });
}

async function downscaleDataUrl(dataUrl, maxDimension) {
  const image = await loadImage(dataUrl);
  const longestSide = Math.max(image.width, image.height);
  if (longestSide <= maxDimension) {
    return dataUrl;
  }

  const scale = maxDimension / longestSide;
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.9);
}

function createId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const normalized = clean.length === 3
    ? clean.split("").map((char) => char + char).join("")
    : clean;
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b].map((value) => value.toString(16).padStart(2, "0")).join("")}`;
}

function colorDistance(a, b) {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

function shiftColor(rgb, amount) {
  return {
    r: clamp(rgb.r + amount, 0, 255),
    g: clamp(rgb.g + amount, 0, 255),
    b: clamp(rgb.b + amount, 0, 255),
  };
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function roundRect(ctx, x, y, width, height, radius) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + width, y, x + width, y + height, r);
  ctx.arcTo(x + width, y + height, x, y + height, r);
  ctx.arcTo(x, y + height, x, y, r);
  ctx.arcTo(x, y, x + width, y, r);
  ctx.closePath();
}

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function dataUrlToFile(dataUrl, filename) {
  const [meta, content] = dataUrl.split(",");
  const mime = meta.match(/:(.*?);/)[1];
  const binary = atob(content);
  const length = binary.length;
  const bytes = new Uint8Array(length);

  for (let index = 0; index < length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return new File([bytes], filename, { type: mime });
}

init();
