// Main App — Brick Mosaic Studio
// Kiosk-style layout: top yellow stud rail, 3-col main (camera/controls | stage | jar wall), bottom export dock.

const { useState, useEffect, useRef, useCallback, useMemo } = React;

// Tweakable defaults — host may rewrite this block.
const TWEAKS = /*EDITMODE-BEGIN*/{
  "canvasBg": "studio",
  "layout": "kiosk",
  "showStuds": true,
  "dither": true
}/*EDITMODE-END*/;

const EXPORT_PRESETS = {
  a5:           { label: 'A5',        w: 148, h: 210 },
  a4:           { label: 'A4',        w: 210, h: 297 },
  'a4-ls':      { label: 'A4 ↔',      w: 297, h: 210 },
  '4x6':        { label: '4×6',       w: 102, h: 152 },
  square:       { label: 'Square',    w: 200, h: 200 },
};

function App() {
  // ── Source state ──
  const [sourceMode, setSourceMode] = useState('demo'); // 'camera' | 'upload' | 'demo'
  const [captured, setCaptured] = useState(null); // HTMLImageElement | HTMLCanvasElement — frozen frame
  const [demoIndex, setDemoIndex] = useState(0);
  const [cameraOn, setCameraOn] = useState(false);
  const [cameraError, setCameraError] = useState(null);
  const videoRef = useRef(null);
  const streamRef = useRef(null);

  // ── Controls ──
  const [preset, setPreset] = useState('original');
  const [density, setDensity] = useState(48);
  const [smoothing, setSmoothing] = useState(24);
  const [exportSize, setExportSize] = useState('a4');
  const [dpi, setDpi] = useState(200);
  const [showStuds, setShowStuds] = useState(TWEAKS.showStuds);

  // ── Tweaks ──
  const [canvasBg, setCanvasBg] = useState(TWEAKS.canvasBg);
  const [layout, setLayout] = useState(TWEAKS.layout);
  const [editMode, setEditMode] = useState(false);
  const [tweaksOpen, setTweaksOpen] = useState(false);
  const [dither, setDither] = useState(TWEAKS.dither !== false);
  const [photoOpen, setPhotoOpen] = useState(true);
  const [jarOpen, setJarOpen] = useState(true);
  const [lookOpen, setLookOpen] = useState(true);
  const [statsOpen, setStatsOpen] = useState(true);
  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [dlOpen, setDlOpen] = useState(false);

  // Zoom + pan + 3D tilt for mosaic frame
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({x:0, y:0});
  const [frameColor, setFrameColor] = useState('red');
  const [tiltOn, setTiltOn] = useState(true);
  const [tilt, setTilt] = useState({rx:0, ry:0});
  const stageRef = useRef(null);
  const panRef = useRef({dragging:false, sx:0, sy:0, px:0, py:0});

  function onWheel(e) {
    if (!captured) return;
    e.preventDefault();
    const delta = -e.deltaY * 0.0015;
    setZoom(z => Math.min(4, Math.max(0.4, z * (1 + delta))));
  }
  function onPanStart(e) {
    if (!captured) return;
    panRef.current = { dragging:true, sx:e.clientX, sy:e.clientY, px:pan.x, py:pan.y };
  }
  function onPanMove(e) {
    if (!panRef.current.dragging) {
      if (tiltOn && stageRef.current) {
        const r = stageRef.current.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        setTilt({ rx: (0.5 - py) * 10, ry: (px - 0.5) * 14 });
      }
      return;
    }
    setPan({ x: panRef.current.px + (e.clientX - panRef.current.sx), y: panRef.current.py + (e.clientY - panRef.current.sy) });
  }
  function onPanEnd() { panRef.current.dragging = false; }
  function onStageLeave() { setTilt({rx:0, ry:0}); panRef.current.dragging = false; }
  function resetView() { setZoom(1); setPan({x:0,y:0}); }

  // ── Mosaic output ──
  const [recipe, setRecipe] = useState([]);
  const [studsWide, setStudsWide] = useState(0);
  const [studsTall, setStudsTall] = useState(0);
  const [total, setTotal] = useState(0);
  const canvasRef = useRef(null);

  // Demo photo URLs (Unsplash CDN — small portraits & objects)
  const demoImages = useMemo(() => [
    { src: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=600&h=600&fit=crop', label: 'Portrait' },
    { src: 'https://images.unsplash.com/photo-1552053831-71594a27632d?w=600&h=600&fit=crop', label: 'Pup' },
    { src: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?w=600&h=600&fit=crop', label: 'Cat' },
    { src: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?w=600&h=600&fit=crop', label: 'Landscape' },
  ], []);

  // Load demo image → HTMLImageElement → captured
  useEffect(() => {
    if (sourceMode !== 'demo') return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => setCaptured(img);
    img.onerror = () => setCaptured(null);
    img.src = demoImages[demoIndex].src;
  }, [sourceMode, demoIndex, demoImages]);

  // Camera lifecycle
  useEffect(() => {
    if (sourceMode !== 'camera') {
      stopCamera();
      return;
    }
    startCamera();
    return () => stopCamera();
  }, [sourceMode]);

  async function startCamera() {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraOn(true);
    } catch (err) {
      setCameraError(err && err.message ? err.message : 'Camera unavailable');
      setCameraOn(false);
    }
  }
  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setCameraOn(false);
  }

  // Capture frame from video
  const captureFrame = useCallback(() => {
    if (!videoRef.current || !cameraOn) return;
    const v = videoRef.current;
    const cvs = document.createElement('canvas');
    cvs.width = v.videoWidth || 640;
    cvs.height = v.videoHeight || 480;
    const ctx = cvs.getContext('2d');
    // mirror flip to match user view
    ctx.translate(cvs.width, 0);
    ctx.scale(-1, 1);
    ctx.drawImage(v, 0, 0, cvs.width, cvs.height);
    setCaptured(cvs);
  }, [cameraOn]);

  // Handle file upload
  const handleUpload = useCallback((e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    setSourceMode('upload');
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { setCaptured(img); URL.revokeObjectURL(url); };
    img.src = url;
  }, []);

  // Derive aspect ratio from current source / export
  const aspect = useMemo(() => {
    const p = EXPORT_PRESETS[exportSize];
    return p ? p.w / p.h : 1;
  }, [exportSize]);

  // Re-render mosaic whenever inputs change
  useEffect(() => {
    if (!captured || !canvasRef.current) return;
    const palette = window.paletteFor(preset);
    const result = window.renderMosaic({
      source: captured,
      targetCanvas: canvasRef.current,
      studsWide: density,
      aspectRatio: aspect,
      smoothing: smoothing / 100,
      palette,
      showStuds,
      dither,
    });
    setRecipe(result.recipe);
    setStudsWide(result.studsWide);
    setStudsTall(result.studsTall);
    setTotal(result.total);
  }, [captured, preset, density, smoothing, aspect, showStuds, dither]);

  // Edit mode handshake
  useEffect(() => {
    function onMsg(ev) {
      const m = ev.data;
      if (!m || typeof m !== 'object') return;
      if (m.type === '__activate_edit_mode') setEditMode(true);
      if (m.type === '__deactivate_edit_mode') setEditMode(false);
    }
    window.addEventListener('message', onMsg);
    window.parent && window.parent.postMessage({ type: '__edit_mode_available' }, '*');
    return () => window.removeEventListener('message', onMsg);
  }, []);

  function persistTweak(key, val) {
    window.parent && window.parent.postMessage({ type: '__edit_mode_set_keys', edits: { [key]: val } }, '*');
  }

  // ── Download helpers ─────────────────────────────────────────
  const FRAME_COLOR_MAP = {
    red:    { base:'#E3000B', deep:'#B20008', hi:'#FF6A70' },
    yellow: { base:'#FFD500', deep:'#E6B800', hi:'#FFEC66' },
    blue:   { base:'#006CB7', deep:'#004F87', hi:'#4BA3E1' },
    green:  { base:'#00A651', deep:'#007A3D', hi:'#3FD087' },
    black:  { base:'#0A0D12', deep:'#000000', hi:'#3A3D42' },
    white:  { base:'#F5F5F5', deep:'#CFCFCF', hi:'#FFFFFF' },
  };

  // Compose a new canvas with a LEGO brick frame around the mosaic.
  function composeWithFrame(srcCanvas, frameKey='red') {
    const c = FRAME_COLOR_MAP[frameKey] || FRAME_COLOR_MAP.red;
    const pad = 64;
    const out = document.createElement('canvas');
    out.width = srcCanvas.width + pad * 2;
    out.height = srcCanvas.height + pad * 2;
    const ctx = out.getContext('2d');
    // Base frame fill
    ctx.fillStyle = c.base;
    ctx.fillRect(0, 0, out.width, out.height);
    // Outer highlight + inner shadow for depth
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(0, 0, out.width, 4);
    ctx.fillRect(0, 0, 4, out.height);
    ctx.fillStyle = c.deep;
    ctx.fillRect(0, out.height - 6, out.width, 6);
    ctx.fillRect(out.width - 6, 0, 6, out.height);
    // Studs around the border
    const studR = 11;
    const gap = 32;
    function drawStud(x, y) {
      const grad = ctx.createRadialGradient(x - 3, y - 4, 1, x, y, studR);
      grad.addColorStop(0, c.hi);
      grad.addColorStop(0.6, c.base);
      grad.addColorStop(1, c.deep);
      ctx.fillStyle = grad;
      ctx.beginPath(); ctx.arc(x, y, studR, 0, Math.PI*2); ctx.fill();
    }
    // top & bottom rows (2 rows each)
    for (let x = gap/2; x < out.width; x += gap) {
      drawStud(x, 14); drawStud(x, 14 + 26);
      drawStud(x, out.height - 14); drawStud(x, out.height - 14 - 26);
    }
    // left & right columns (2 columns each)
    for (let y = pad + gap/2; y < out.height - pad; y += gap) {
      drawStud(14, y); drawStud(14 + 26, y);
      drawStud(out.width - 14, y); drawStud(out.width - 14 - 26, y);
    }
    // White mat behind the mosaic
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(pad - 6, pad - 6, srcCanvas.width + 12, srcCanvas.height + 12);
    // Draw mosaic
    ctx.drawImage(srcCanvas, pad, pad);
    return out;
  }

  function triggerDownload(dataUrl, filename) {
    const a = document.createElement('a');
    a.href = dataUrl; a.download = filename; a.click();
  }

  function downloadAs(format, withFrame) {
    if (!canvasRef.current) return;
    const base = withFrame ? composeWithFrame(canvasRef.current, frameColor) : canvasRef.current;
    const tag = `${studsWide}x${studsTall}${withFrame ? '-framed' : ''}`;
    if (format === 'svg') {
      const png = base.toDataURL('image/png');
      const w = base.width, h = base.height;
      const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <image width="${w}" height="${h}" href="${png}" image-rendering="pixelated" style="image-rendering: pixelated"/>
</svg>`;
      const blob = new Blob([svg], { type: 'image/svg+xml' });
      triggerDownload(URL.createObjectURL(blob), `brick-mosaic-${tag}.svg`);
    } else if (format === 'jpg') {
      triggerDownload(base.toDataURL('image/jpeg', 0.95), `brick-mosaic-${tag}.jpg`);
    } else {
      triggerDownload(base.toDataURL('image/png'), `brick-mosaic-${tag}.png`);
    }
    setDlOpen(false);
  }

  // Back-compat quick PNG (used by the top "Save" rail button)
  function downloadPng() { downloadAs('png', false); }

  async function sharePng() {
    if (!canvasRef.current) return;
    canvasRef.current.toBlob(async (blob) => {
      if (!blob) return;
      const file = new File([blob], 'mosaic.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        try { await navigator.share({ files: [file], title: 'My Brick Mosaic' }); return; } catch {}
      }
      try {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        alert('Mosaic copied to clipboard');
      } catch {
        downloadPng();
      }
    });
  }

  // Max count for jar scaling
  const maxCount = Math.max(1, ...(recipe.map(r => r.count)));
  const totalUnique = recipe.length;

  const paletteLabel = (window.PALETTE_META && window.PALETTE_META[preset] && window.PALETTE_META[preset].label) || preset;
  const exportLabel = EXPORT_PRESETS[exportSize].label;

  return (
    <div className={`app layout-${layout} ${leftOpen?'':'left-hidden'} ${rightOpen?'':'right-hidden'}`}>
      {/* ───── Top yellow stud rail ───── */}
      <header className="studrail">
        <div className="brand">
          <div className="brand-mark"><span /></div>
          <div>
            <div className="brand-name">Brick Mosaic Studio</div>
            <div className="brand-sub">In-store build kiosk · Bay 3</div>
          </div>
        </div>
        <div className="rail-center">
          <div className="location-pill">
            <span className="dot" />
            Flagship Store · Copenhagen
          </div>
        </div>
        <div className="rail-right">
          <button className="rail-btn" onClick={() => { setCaptured(null); setSourceMode('demo'); setDemoIndex(0); }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>
            Restart
          </button>
          <button className="rail-btn" onClick={downloadPng} disabled={!captured}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
            Save
          </button>
        </div>
      </header>

      {/* ───── MAIN: 3 cols ───── */}
      <main className="main">
        {/* Edge tabs to reopen collapsed sidebars */}
        {!leftOpen && (
          <button className="edge-tab edge-tab-left" onClick={() => setLeftOpen(true)} title="Show controls">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
          </button>
        )}
        {!rightOpen && (
          <button className="edge-tab edge-tab-right" onClick={() => setRightOpen(true)} title="Show stats">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          </button>
        )}
        {/* LEFT — Source + Look */}
        {leftOpen && <div className="col col-left">
          <div className="col-head">
            <span className="col-title">Controls</span>
            <button className="col-collapse" onClick={() => setLeftOpen(false)} title="Collapse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
            </button>
          </div>
          <section className={`panel ${photoOpen?'':'collapsed'}`}>
            <button className="panel-head panel-head-btn" onClick={() => setPhotoOpen(o=>!o)}>
              <h3>Your photo</h3>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <span className="stud-accent"><span /><span /><span /></span>
                <span className={`panel-caret ${photoOpen?'open':''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </span>
            </button>
            {photoOpen && <div className="panel-body">
              <div className="source-tabs" role="tablist">
                <button className={`source-tab ${sourceMode==='camera'?'on':''}`} onClick={() => setSourceMode('camera')}>Camera</button>
                <button className={`source-tab ${sourceMode==='upload'?'on':''}`} onClick={() => document.getElementById('file-in').click()}>Upload</button>
                <button className={`source-tab ${sourceMode==='demo'?'on':''}`} onClick={() => setSourceMode('demo')}>Demos</button>
                <input id="file-in" type="file" accept="image/*" style={{display:'none'}} onChange={handleUpload} />
              </div>

              <div className="viewfinder">
                {sourceMode === 'camera' && (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{transform:'scaleX(-1)'}} />
                    {!cameraOn && !cameraError && (
                      <div className="vf-placeholder">Starting camera…</div>
                    )}
                    {cameraError && (
                      <div className="vf-placeholder">
                        Camera unavailable<br /><small>{cameraError}</small>
                      </div>
                    )}
                    {cameraOn && <><span className="vf-live"><span className="d" />LIVE</span></>}
                  </>
                )}
                {sourceMode === 'upload' && captured && <img src={captured.src || captured.toDataURL?.()} alt="Uploaded" />}
                {sourceMode === 'upload' && !captured && (
                  <div className="vf-placeholder">Drop or browse a photo</div>
                )}
                {sourceMode === 'demo' && captured && <img src={captured.src || ''} alt="Demo" />}
                {sourceMode === 'demo' && !captured && (
                  <div className="vf-placeholder">Loading sample…</div>
                )}
                <span className="vf-corner tl" /><span className="vf-corner tr" />
                <span className="vf-corner bl" /><span className="vf-corner br" />
              </div>

              {sourceMode === 'camera' ? (
                <button className="capture-btn" onClick={captureFrame} disabled={!cameraOn}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
                  Snap Photo
                </button>
              ) : sourceMode === 'demo' ? (
                <div className="source-actions">
                  {demoImages.map((d, i) => (
                    <button key={i} className={`btn-brick ${i===demoIndex?'primary':''}`}
                      style={{flex:1, padding:'9px 6px', fontSize:12}}
                      onClick={() => setDemoIndex(i)}>{d.label}</button>
                  ))}
                </div>
              ) : (
                <button className="btn-brick primary" onClick={() => document.getElementById('file-in').click()}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Choose file
                </button>
              )}
            </div>}
          </section>

          <section className={`panel ${lookOpen?'':'collapsed'}`}>
            <button className="panel-head panel-head-btn" onClick={() => setLookOpen(o=>!o)}>
              <h3>Look</h3>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <span className="chip red">{paletteLabel}</span>
                <span className={`panel-caret ${lookOpen?'open':''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </span>
            </button>
            {lookOpen && <div className="panel-body">
              <div className="preset-row preset-row-wide">
                {Object.entries(window.PALETTE_META || {}).map(([k, meta]) => {
                  const pal = window.paletteFor(k).slice(0, 8);
                  return (
                    <button key={k} className={`preset-chip ${preset===k?'on':''}`} onClick={() => setPreset(k)} title={meta.desc}>
                      <div className="sw sw-studs">
                        {pal.map((c, i) => (
                          <span key={i} className="sw-stud" style={{background: c.hex}}>
                            <span className="sw-stud-top" style={{background: c.hex}}/>
                          </span>
                        ))}
                      </div>
                      {meta.label}
                    </button>
                  );
                })}
              </div>
              <div className="field">
                <label>Accuracy boost <span className="val">{dither?'Dither on':'Off'}</span></label>
                <div className="toggle-row" style={{width:'100%'}}>
                  <button className={dither?'on':''} style={{flex:1}} onClick={() => setDither(true)}>Dithered</button>
                  <button className={!dither?'on':''} style={{flex:1}} onClick={() => setDither(false)}>Flat</button>
                </div>
                <span className="help">Dithering blends palette colors for photo-accurate tones.</span>
              </div>
              <div className="field">
                <label>Brick density <span className="val">{density} studs</span></label>
                <input type="range" min="20" max="96" value={density}
                  style={{'--pct': `${((density-20)/(96-20))*100}%`}}
                  onChange={(e) => setDensity(+e.target.value)} />
                <span className="help">How many studs across the longest side.</span>
              </div>
              <div className="field">
                <label>Smoothing <span className="val">{smoothing}%</span></label>
                <input type="range" min="0" max="100" value={smoothing}
                  style={{'--pct': `${smoothing}%`}}
                  onChange={(e) => setSmoothing(+e.target.value)} />
              </div>
            </div>}
          </section>
        </div>}

        {/* CENTER — Pure mosaic frame, no chrome */}
        <div className="col col-center">
          <section className="stage stage-bare">
            <div
              ref={stageRef}
              className={`build-surface bg-${canvasBg}`}
              onWheel={onWheel}
              onMouseMove={onPanMove}
              onMouseDown={onPanStart}
              onMouseUp={onPanEnd}
              onMouseLeave={onStageLeave}
              style={{cursor: captured ? (panRef.current.dragging ? 'grabbing' : 'grab') : 'default'}}
            >
              {captured ? (
                <div className={`mosaic-frame brickframe-wrap floating-3d frame-${frameColor}`}
                  style={{
                    transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom}) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
                  }}
                >
                  <div className="brickframe" aria-hidden="true">
                    <div className="bf bf-row bf-row-1">{Array.from({length:14}).map((_,i)=>(<div key={i} className="bf-stud"/>))}</div>
                    <div className="bf bf-row bf-row-2">{Array.from({length:14}).map((_,i)=>(<div key={i} className="bf-stud"/>))}</div>
                    <div className="bf bf-bot bf-bot-1"/>
                    <div className="bf bf-bot bf-bot-2"/>
                    <div className="bf bf-side bf-side-l1"/>
                    <div className="bf bf-side bf-side-l2"/>
                    <div className="bf bf-side bf-side-r1"/>
                    <div className="bf bf-side bf-side-r2"/>
                  </div>
                  <div className="canvas-wrap"><canvas ref={canvasRef} /></div>
                </div>
              ) : (
                <div className="empty-stage">
                  <div className="icon" />
                  <h4>Start with a photo</h4>
                  <p>Snap one with the camera, upload an image, or try a demo portrait to see your mosaic come to life.</p>
                </div>
              )}

              {/* Zoom controls */}
              {captured && (
                <div className="zoom-dock">
                  <button onClick={() => setZoom(z => Math.min(4, z * 1.2))} title="Zoom in">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="11" y1="8" x2="11" y2="14"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  </button>
                  <div className="zoom-pct">{Math.round(zoom*100)}%</div>
                  <button onClick={() => setZoom(z => Math.max(0.4, z / 1.2))} title="Zoom out">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/><line x1="8" y1="11" x2="14" y2="11"/></svg>
                  </button>
                  <div className="zoom-sep"/>
                  <button onClick={resetView} title="Reset view">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/></svg>
                  </button>
                  <button className={tiltOn?'on':''} onClick={() => { setTiltOn(t => !t); setTilt({rx:0,ry:0}); }} title="3D float">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2"/><line x1="12" y1="22" x2="12" y2="15.5"/><polyline points="22 8.5 12 15.5 2 8.5"/></svg>
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>

        {/* RIGHT — Stats, Jar Wall, Tips */}
        {rightOpen && <div className="col col-right">
          <div className="col-head">
            <span className="col-title">Build info</span>
            <button className="col-collapse" onClick={() => setRightOpen(false)} title="Collapse">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
          <section className={`panel ${statsOpen?'':'collapsed'}`}>
            <button className="panel-head panel-head-btn" onClick={() => setStatsOpen(o=>!o)}>
              <h3>Build stats</h3>
              <span className={`panel-caret ${statsOpen?'open':''}`}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
              </span>
            </button>
            {statsOpen && (
              <div className="panel-body compact">
                <div className="sidebar-stats">
                  <div className="stat"><div className="k">Total bricks</div><div className="v">{total.toLocaleString()}</div></div>
                  <div className="stat"><div className="k">Unique colors</div><div className="v">{totalUnique}</div></div>
                  <div className="stat"><div className="k">Grid</div><div className="v">{studsWide||'—'}×{studsTall||'—'}</div></div>
                  <div className="stat"><div className="k">Print</div><div className="v">{exportLabel}</div></div>
                  <div className="stat"><div className="k">Palette</div><div className="v" style={{fontSize:14}}>{paletteLabel}</div></div>
                  <div className="stat"><div className="k">Output</div><div className="v" style={{fontSize:14}}>{dpi} DPI</div></div>
                </div>
                <div className="toggle-row" style={{marginTop:10}}>
                  <button className={showStuds?'on':''} onClick={() => setShowStuds(true)}>Studs</button>
                  <button className={!showStuds?'on':''} onClick={() => setShowStuds(false)}>Flat</button>
                </div>
                <div className="field" style={{marginTop:12}}>
                  <label>Frame color</label>
                  <div className="frame-picker">
                    {[
                      {k:'red', c:'#E3000B', label:'Red'},
                      {k:'yellow', c:'#FFD500', label:'Yellow'},
                      {k:'blue', c:'#006CB7', label:'Blue'},
                      {k:'green', c:'#00A651', label:'Green'},
                      {k:'black', c:'#0A0D12', label:'Black'},
                      {k:'white', c:'#F5F5F5', label:'White'},
                    ].map(f => (
                      <button key={f.k}
                        className={`fp ${frameColor===f.k?'on':''}`}
                        onClick={() => setFrameColor(f.k)}
                        title={f.label}
                        style={{background: f.c, borderColor: f.k==='white' ? '#D5D7DA' : 'transparent'}}
                      >
                        <span className="fp-stud"/>
                        <span className="fp-stud"/>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className={`panel ${jarOpen?'':'collapsed'}`}>
            <button className="panel-head panel-head-btn" onClick={() => setJarOpen(o=>!o)}>
              <div style={{textAlign:'left'}}>
                <h3>Jar of bricks</h3>
                <div className="sub">Pick one of each — stacked the way you'd grab them at the store.</div>
              </div>
              <span style={{display:'inline-flex',alignItems:'center',gap:8}}>
                <span className="chip yellow">{recipe.length} jars</span>
                <span className={`panel-caret ${jarOpen?'open':''}`}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
                </span>
              </span>
            </button>
            {jarOpen && <>
            <div className="panel-body compact">
              {recipe.length === 0 ? (
                <div style={{padding:'24px 4px', textAlign:'center', color:'var(--fg-tertiary)', fontSize:13}}>
                  Bricks will appear here once your mosaic is rendered.
                </div>
              ) : (
                <div className="jar-wall">
                  {recipe.slice(0, 40).map((r) => (
                    <window.BrickJar
                      key={r.color.name}
                      color={r.color.hex}
                      count={r.count}
                      max={maxCount}
                      name={r.color.name}
                    />
                  ))}
                </div>
              )}
              {recipe.length > 40 && (
                <div style={{textAlign:'center', fontSize:12, color:'var(--fg-tertiary)', paddingTop:8}}>
                  + {recipe.length - 40} smaller jars not shown
                </div>
              )}
            </div></>}
          </section>

          <section className="panel">
            <div className="panel-head">
              <h3>Build tips</h3>
            </div>
            <div className="panel-body compact">
              <div className="mode-hint">
                <span className="d" />
                <span>Start with the densest color first — usually the background — then work outward. Use the jar labels to count your pulls.</span>
              </div>
              <div className="field">
                <label>Baseplate size</label>
                <div style={{fontSize:14,color:'var(--fg-secondary)'}}>
                  Needs <b>{Math.ceil(studsWide/32)||0}×{Math.ceil(studsTall/32)||0}</b> × 32-stud baseplates to cover {studsWide}×{studsTall}.
                </div>
              </div>
            </div>}
          </section>
        </div>}
      </main>

      {/* ───── Bottom export dock ───── */}
      <footer className="dock">
        <div className="dock-left">
          <div style={{fontSize:12, color:'var(--fg-tertiary)', fontWeight:600}}>Export size</div>
          <div className="export-seg">
            {Object.entries(EXPORT_PRESETS).map(([k, v]) => (
              <button key={k} className={exportSize===k?'on':''} onClick={() => setExportSize(k)}>{v.label}</button>
            ))}
          </div>
          <select className="dpi-select" value={dpi} onChange={e => setDpi(+e.target.value)}>
            <option value={150}>150 DPI</option>
            <option value={200}>200 DPI</option>
            <option value={300}>300 DPI</option>
          </select>
        </div>
        <div className="dock-center">
          <span style={{fontSize:13, color:'var(--fg-tertiary)'}}>
            Need <b style={{color:'var(--fg-primary)'}}>{total.toLocaleString()}</b> bricks in <b style={{color:'var(--fg-primary)'}}>{totalUnique}</b> colors
          </span>
        </div>
        <div className="dock-right">
          <button className="btn-brick" onClick={sharePng} disabled={!captured}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
            Share
          </button>
          <div className="dl-split">
            <button className="btn-brick blue dl-main" onClick={() => downloadAs('png', false)} disabled={!captured}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              Download
            </button>
            <button className="btn-brick blue dl-caret" onClick={() => setDlOpen(o => !o)} disabled={!captured} aria-label="More download options">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {dlOpen && (
              <>
                <div className="dl-backdrop" onClick={() => setDlOpen(false)} />
                <div className="dl-menu" role="menu">
                  <div className="dl-group">
                    <div className="dl-group-label">Without frame</div>
                    <button onClick={() => downloadAs('png', false)}>PNG <span className="dl-hint">transparent edges</span></button>
                    <button onClick={() => downloadAs('jpg', false)}>JPG <span className="dl-hint">smaller size</span></button>
                    <button onClick={() => downloadAs('svg', false)}>SVG <span className="dl-hint">scalable</span></button>
                  </div>
                  <div className="dl-sep" />
                  <div className="dl-group">
                    <div className="dl-group-label">With LEGO frame</div>
                    <button onClick={() => downloadAs('png', true)}>PNG <span className="dl-hint">framed</span></button>
                    <button onClick={() => downloadAs('jpg', true)}>JPG <span className="dl-hint">framed</span></button>
                    <button onClick={() => downloadAs('svg', true)}>SVG <span className="dl-hint">framed</span></button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </footer>

      {/* ───── Tweaks panel (collapsible) ───── */}
      {editMode && (
        <>
          <button
            className="tweaks-fab"
            onClick={() => setTweaksOpen(o => !o)}
            aria-expanded={tweaksOpen}
            title={tweaksOpen ? 'Collapse tweaks' : 'Open tweaks'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
            Tweaks
            <span className="caret" style={{transform: tweaksOpen?'rotate(180deg)':'rotate(0deg)'}}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
            </span>
          </button>
          {tweaksOpen && (
            <div className="tweaks-panel">
              <h4>
                Tweaks
                <button className="tweaks-close" onClick={() => setTweaksOpen(false)} aria-label="Close">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </h4>
              <div className="tweak-group">
                <div className="label">Canvas background</div>
                <div className="tweak-opts">
                  {['studio','plain','brick','baseplate','dark'].map(b => (
                    <button key={b} className={canvasBg===b?'on':''}
                      onClick={() => { setCanvasBg(b); persistTweak('canvasBg', b); }}>
                      {b.charAt(0).toUpperCase() + b.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tweak-group">
                <div className="label">Layout</div>
                <div className="tweak-opts">
                  {['kiosk','workshop','compact'].map(l => (
                    <button key={l} className={layout===l?'on':''}
                      onClick={() => { setLayout(l); persistTweak('layout', l); }}>
                      {l.charAt(0).toUpperCase() + l.slice(1)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="tweak-group">
                <div className="label">Stud rendering</div>
                <div className="tweak-opts">
                  <button className={showStuds?'on':''} onClick={() => { setShowStuds(true); persistTweak('showStuds', true); }}>Studs on</button>
                  <button className={!showStuds?'on':''} onClick={() => { setShowStuds(false); persistTweak('showStuds', false); }}>Studs off</button>
                </div>
              </div>
              <div className="tweak-group">
                <div className="label">Accuracy</div>
                <div className="tweak-opts">
                  <button className={dither?'on':''} onClick={() => { setDither(true); persistTweak('dither', true); }}>Dithered</button>
                  <button className={!dither?'on':''} onClick={() => { setDither(false); persistTweak('dither', false); }}>Flat</button>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

window.App = App;
