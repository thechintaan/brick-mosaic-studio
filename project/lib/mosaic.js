// Mosaic rendering engine.
// Given: source HTMLImageElement or HTMLVideoElement or HTMLCanvasElement,
//        density (studs across), smoothing (0..1), paletteKey, aspect (w,h ratio)
// Produces: drawn canvas + recipe (array of {color, count, pct}) + studsWide/studsTall.

(function () {
  function drawSourceToScratch(source, targetW, targetH) {
    // Fit source "cover" style into target box, centered crop.
    const scratch = document.createElement('canvas');
    scratch.width = targetW;
    scratch.height = targetH;
    const ctx = scratch.getContext('2d', { willReadFrequently: true });
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetW, targetH);

    let sw = source.width || source.videoWidth || source.naturalWidth || 1;
    let sh = source.height || source.videoHeight || source.naturalHeight || 1;
    if (sw === 0 || sh === 0) return scratch;

    const srcRatio = sw / sh;
    const tgtRatio = targetW / targetH;

    let drawW, drawH, sx, sy, sWidth, sHeight;
    if (srcRatio > tgtRatio) {
      // source wider — crop sides
      sHeight = sh;
      sWidth = sh * tgtRatio;
      sx = (sw - sWidth) / 2;
      sy = 0;
    } else {
      sWidth = sw;
      sHeight = sw / tgtRatio;
      sx = 0;
      sy = (sh - sHeight) / 2;
    }
    ctx.drawImage(source, sx, sy, sWidth, sHeight, 0, 0, targetW, targetH);
    return scratch;
  }

  // Simple box blur via repeated canvas draw. Cheap but acceptable.
  function blur(canvas, radius) {
    if (radius <= 0) return canvas;
    const ctx = canvas.getContext('2d');
    ctx.filter = `blur(${radius}px)`;
    const tmp = document.createElement('canvas');
    tmp.width = canvas.width; tmp.height = canvas.height;
    tmp.getContext('2d').drawImage(canvas, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(tmp, 0, 0);
    ctx.filter = 'none';
    return canvas;
  }

  function renderMosaic(opts) {
    const {
      source,
      targetCanvas,
      studsWide,
      aspectRatio = 1, // width / height
      smoothing = 0.2, // 0..1
      palette,
      showStuds = true,
      studStyle = 'round',
      contrast = 0, // -1..1
      brightness = 0, // -1..1
    } = opts;

    const studsTall = Math.max(1, Math.round(studsWide / aspectRatio));

    // Scratch downsampled image (one pixel per stud)
    const scratch = drawSourceToScratch(source, Math.max(studsWide * 4, 16), Math.max(studsTall * 4, 16));
    blur(scratch, Math.max(0, smoothing * 6));

    // Downsample to stud grid.
    const grid = document.createElement('canvas');
    grid.width = studsWide; grid.height = studsTall;
    const gctx = grid.getContext('2d', { willReadFrequently: true });
    gctx.imageSmoothingEnabled = true;
    gctx.imageSmoothingQuality = 'high';
    gctx.drawImage(scratch, 0, 0, studsWide, studsTall);

    const imgData = gctx.getImageData(0, 0, studsWide, studsTall);
    const data = imgData.data;

    // Apply brightness/contrast in-place (use Float32 for dithering).
    const buf = new Float32Array(data.length);
    for (let i = 0; i < data.length; i += 4) {
      let r = data[i], g = data[i + 1], b = data[i + 2];
      if (brightness !== 0) {
        r += brightness * 255; g += brightness * 255; b += brightness * 255;
      }
      if (contrast !== 0) {
        const f = (259 * (contrast * 255 + 255)) / (255 * (259 - contrast * 255));
        r = f * (r - 128) + 128;
        g = f * (g - 128) + 128;
        b = f * (b - 128) + 128;
      }
      buf[i] = r; buf[i + 1] = g; buf[i + 2] = b; buf[i + 3] = 255;
    }

    // Build mosaic pixel array with optional Floyd-Steinberg dithering.
    const mapped = new Uint8ClampedArray(data.length);
    const counts = new Map();
    const dither = opts.dither !== false; // on by default
    const dstrength = typeof opts.ditherStrength === 'number' ? opts.ditherStrength : 0.75;

    for (let y = 0; y < studsTall; y++) {
      for (let x = 0; x < studsWide; x++) {
        const idx = (y * studsWide + x) * 4;
        const r = Math.max(0, Math.min(255, buf[idx]));
        const g = Math.max(0, Math.min(255, buf[idx + 1]));
        const b = Math.max(0, Math.min(255, buf[idx + 2]));
        const c = window.nearestColor(r, g, b, palette);
        mapped[idx] = c.rgb[0];
        mapped[idx + 1] = c.rgb[1];
        mapped[idx + 2] = c.rgb[2];
        mapped[idx + 3] = 255;
        const prev = counts.get(c.name);
        if (prev) prev.count++; else counts.set(c.name, { color: c, count: 1 });
        if (dither) {
          const er = (r - c.rgb[0]) * dstrength;
          const eg = (g - c.rgb[1]) * dstrength;
          const eb = (b - c.rgb[2]) * dstrength;
          // Floyd-Steinberg: 7/16 right, 3/16 bl, 5/16 b, 1/16 br
          const spread = (dx, dy, w) => {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || nx >= studsWide || ny < 0 || ny >= studsTall) return;
            const ni = (ny * studsWide + nx) * 4;
            buf[ni] += er * w;
            buf[ni + 1] += eg * w;
            buf[ni + 2] += eb * w;
          };
          spread(1, 0, 7 / 16);
          spread(-1, 1, 3 / 16);
          spread(0, 1, 5 / 16);
          spread(1, 1, 1 / 16);
        }
      }
    }

    // Paint onto the target canvas at a nice visual size.
    const tctx = targetCanvas.getContext('2d');
    const studPx = 20; // each stud rendered at 20px in visual preview
    const outW = studsWide * studPx;
    const outH = studsTall * studPx;
    targetCanvas.width = outW;
    targetCanvas.height = outH;
    tctx.clearRect(0, 0, outW, outH);

    // Pass 1: base brick tiles
    for (let y = 0; y < studsTall; y++) {
      for (let x = 0; x < studsWide; x++) {
        const idx = (y * studsWide + x) * 4;
        const r = mapped[idx], g = mapped[idx + 1], b = mapped[idx + 2];
        tctx.fillStyle = `rgb(${r},${g},${b})`;
        tctx.fillRect(x * studPx, y * studPx, studPx, studPx);
      }
    }

    // Pass 2: stud overlay
    if (showStuds) {
      for (let y = 0; y < studsTall; y++) {
        for (let x = 0; x < studsWide; x++) {
          const idx = (y * studsWide + x) * 4;
          const r = mapped[idx], g = mapped[idx + 1], b = mapped[idx + 2];
          const cx = x * studPx + studPx / 2;
          const cy = y * studPx + studPx / 2;
          const radius = studPx * 0.32;

          // Base color slightly darker ring
          tctx.beginPath();
          tctx.arc(cx, cy, radius, 0, Math.PI * 2);
          tctx.fillStyle = `rgba(0,0,0,0.18)`;
          tctx.fill();

          // Stud face (a touch lighter to feel 3D)
          tctx.beginPath();
          tctx.arc(cx, cy - 1, radius - 1, 0, Math.PI * 2);
          tctx.fillStyle = `rgb(${Math.min(255, r + 18)},${Math.min(255, g + 18)},${Math.min(255, b + 18)})`;
          tctx.fill();

          // Highlight
          tctx.beginPath();
          tctx.arc(cx - radius * 0.3, cy - radius * 0.45, radius * 0.35, 0, Math.PI * 2);
          tctx.fillStyle = 'rgba(255,255,255,0.38)';
          tctx.fill();
        }
      }
    }

    // Build recipe sorted by count desc.
    const total = studsWide * studsTall;
    const recipe = [...counts.values()]
      .sort((a, b) => b.count - a.count)
      .map(c => ({ color: c.color, count: c.count, pct: c.count / total }));

    return { recipe, studsWide, studsTall, total };
  }

  window.renderMosaic = renderMosaic;
})();
