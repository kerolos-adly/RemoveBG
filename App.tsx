import { useState, useRef, useCallback, useEffect } from "react";

type Stage = "idle" | "loading-lib" | "processing" | "done" | "error";

interface BgColor {
  label: string;
  value: string;
}

const BG_OPTIONS: BgColor[] = [
  { label: "Transparent", value: "transparent" },
  { label: "White", value: "#ffffff" },
  { label: "Black", value: "#000000" },
  { label: "Light Gray", value: "#e5e7eb" },
  { label: "Dark Gray", value: "#374151" },
  { label: "Violet", value: "#7c3aed" },
  { label: "Blue", value: "#2563eb" },
  { label: "Green", value: "#16a34a" },
  { label: "Red", value: "#dc2626" },
  { label: "Yellow", value: "#ca8a04" },
  { label: "Pink", value: "#db2777" },
  { label: "Teal", value: "#0d9488" },
];

// Declare the CDN-loaded module globally
declare global {
  interface Window {
    __bgRemoval__: {
      removeBackground: (src: unknown, config?: unknown) => Promise<Blob>;
    };
  }
}

export default function App() {
  const [stage, setStage] = useState<Stage>("idle");
  const [progress, setProgress] = useState(0);
  const [progressLabel, setProgressLabel] = useState("");
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultUrl, setResultUrl] = useState<string | null>(null);
  const [selectedBg, setSelectedBg] = useState<BgColor>(BG_OPTIONS[0]);
  const [isDragging, setIsDragging] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [fileName, setFileName] = useState("result.png");
  const [showComparison, setShowComparison] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgModuleRef = useRef<{ removeBackground: (src: unknown, config?: unknown) => Promise<Blob> } | null>(null);

  // Preload the CDN script in background on mount
  useEffect(() => {
    const script = document.createElement("script");
    script.type = "module";
    script.innerHTML = `
      import { removeBackground } from 'https://cdn.jsdelivr.net/npm/@imgly/background-removal@1.7.0/+esm';
      window.__bgRemoval__ = { removeBackground };
    `;
    document.head.appendChild(script);
  }, []);

  const getModule = (): Promise<{ removeBackground: (src: unknown, config?: unknown) => Promise<Blob> }> => {
    return new Promise((resolve, reject) => {
      if (window.__bgRemoval__) {
        resolve(window.__bgRemoval__);
        return;
      }
      let tries = 0;
      const interval = setInterval(() => {
        tries++;
        if (window.__bgRemoval__) {
          clearInterval(interval);
          resolve(window.__bgRemoval__);
        } else if (tries > 60) {
          clearInterval(interval);
          reject(new Error("Library failed to load"));
        }
      }, 500);
    });
  };

  const processImage = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) {
      setErrorMsg("Please upload a valid image file (JPG, PNG, WEBP).");
      setStage("error");
      return;
    }

    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      setErrorMsg("Image is too large. Max allowed size is 10MB.");
      setStage("error");
      return;
    }

    setErrorMsg("");
    setShowComparison(false);
    setResultBlob(null);
    setResultUrl(null);

    const baseName = file.name.replace(/\.[^.]+$/, "");
    setFileName(`${baseName}-no-bg.png`);

    const origUrl = URL.createObjectURL(file);
    setOriginalUrl(origUrl);

    // Check if module is loaded
    if (!window.__bgRemoval__) {
      setStage("loading-lib");
      setProgressLabel("Loading AI model for the first time…");
      setProgress(0);
    } else {
      setStage("processing");
      setProgress(0);
    }

    // Fake progress
    let fakeProgress = 0;
    const progressInterval = setInterval(() => {
      fakeProgress += Math.random() * 2.5;
      if (fakeProgress > 88) fakeProgress = 88;
      setProgress(Math.round(fakeProgress));
      if (fakeProgress < 20) setProgressLabel("Loading AI model…");
      else if (fakeProgress < 45) setProgressLabel("Analyzing image…");
      else if (fakeProgress < 70) setProgressLabel("Detecting edges…");
      else setProgressLabel("Removing background…");
    }, 300);

    try {
      const mod = await getModule();
      bgModuleRef.current = mod;
      setStage("processing");

      const blob = await mod.removeBackground(file, {
        output: { format: "image/png", quality: 1 },
      });

      clearInterval(progressInterval);
      setProgress(100);
      setProgressLabel("Done!");
      setResultBlob(blob);
      const url = URL.createObjectURL(blob);
      setResultUrl(url);
      setStage("done");
    } catch (err) {
      clearInterval(progressInterval);
      console.error(err);
      setErrorMsg("Background removal failed. Please try a different image.");
      setStage("error");
    }
  }, []);

  const handleFile = (file: File) => processImage(file);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  const handleReset = () => {
    setStage("idle");
    setOriginalUrl(null);
    setResultUrl(null);
    setResultBlob(null);
    setProgress(0);
    setProgressLabel("");
    setShowComparison(false);
    setSelectedBg(BG_OPTIONS[0]);
  };

  const handleDownloadPng = () => {
    if (!resultBlob) return;
    const a = document.createElement("a");
    a.href = URL.createObjectURL(resultBlob);
    a.download = fileName;
    a.click();
  };

  const handleDownloadWithBg = () => {
    if (!resultUrl) return;
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d")!;
      if (selectedBg.value !== "transparent") {
        ctx.fillStyle = selectedBg.value;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
      ctx.drawImage(img, 0, 0);
      canvas.toBlob((b) => {
        if (!b) return;
        const a = document.createElement("a");
        a.href = URL.createObjectURL(b);
        a.download = fileName;
        a.click();
      }, "image/png");
    };
    img.src = resultUrl;
  };

  return (
    <div className="min-h-screen bg-[#0a0a12] text-white font-sans">
      {/* Gradient blobs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full bg-violet-600/20 blur-[120px]" />
        <div className="absolute top-1/2 -right-40 w-[500px] h-[500px] rounded-full bg-fuchsia-600/15 blur-[120px]" />
        <div className="absolute -bottom-40 left-1/3 w-[400px] h-[400px] rounded-full bg-indigo-600/15 blur-[100px]" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-white/[0.06]">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <span className="text-lg font-bold tracking-tight bg-gradient-to-r from-violet-300 to-fuchsia-300 bg-clip-text text-transparent">
              BgRemover
            </span>
          </div>
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-white/40">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
            Free · Private · No signup needed
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-5xl mx-auto px-4 py-14">
        {/* Hero */}
        <div className="text-center mb-14">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20 text-violet-300 text-xs font-medium mb-6">
            <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
            AI-Powered Background Removal
          </div>
          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black mb-5 leading-[1.1] tracking-tight">
            Remove Photo{" "}
            <span className="bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-400 bg-clip-text text-transparent">
              Background
            </span>
          </h1>
          <p className="text-white/50 text-lg max-w-lg mx-auto leading-relaxed">
            Upload any image and our AI removes the background instantly — 
            completely free, runs in your browser, no data sent to servers.
          </p>
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {["⚡ Instant AI", "🔒 100% Private", "🎨 Custom BG", "💾 Free Download", "🌐 No API Key"].map((f) => (
              <span
                key={f}
                className="px-3 py-1 rounded-full bg-white/[0.05] border border-white/[0.08] text-white/50 text-xs"
              >
                {f}
              </span>
            ))}
          </div>
        </div>

        {/* ── IDLE: Upload Zone ── */}
        {stage === "idle" && (
          <div
            className={`relative rounded-3xl border-2 border-dashed p-16 text-center cursor-pointer transition-all duration-300 ${
              isDragging
                ? "border-violet-400 bg-violet-500/10 scale-[1.01]"
                : "border-white/[0.1] bg-white/[0.02] hover:border-violet-400/50 hover:bg-violet-500/5"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleInputChange}
            />
            <div className="flex flex-col items-center gap-6">
              <div
                className={`w-24 h-24 rounded-3xl flex items-center justify-center transition-all duration-300 ${
                  isDragging
                    ? "bg-violet-500/30 border-violet-400 scale-110"
                    : "bg-white/5 border border-white/10"
                }`}
              >
                <svg
                  className={`w-11 h-11 transition-colors ${isDragging ? "text-violet-300" : "text-white/30"}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>

              <div>
                <p className="text-2xl font-bold text-white/90 mb-2">
                  {isDragging ? "Drop it here!" : "Drag & drop your image"}
                </p>
                <p className="text-white/40 text-sm">or click anywhere to browse</p>
              </div>

              <button className="px-8 py-3.5 rounded-2xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 font-bold text-sm shadow-xl shadow-violet-500/20 transition-all duration-200 hover:scale-105 hover:shadow-violet-500/40">
                Choose Image
              </button>

              <p className="text-white/20 text-xs">JPG · PNG · WEBP · Max 10MB</p>
            </div>
          </div>
        )}

        {/* ── LOADING LIB / PROCESSING ── */}
        {(stage === "loading-lib" || stage === "processing") && (
          <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] p-12">
            <div className="flex flex-col items-center gap-8">
              {/* Circular Progress */}
              <div className="relative w-32 h-32">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(139,92,246,0.15)" strokeWidth="7" />
                  <circle
                    cx="50" cy="50" r="42"
                    fill="none"
                    stroke="url(#spinGrad)"
                    strokeWidth="7"
                    strokeLinecap="round"
                    strokeDasharray={`${2.639 * progress} ${263.9 - 2.639 * progress}`}
                    strokeDashoffset="0"
                    style={{ transition: "stroke-dasharray 0.4s ease" }}
                  />
                  <defs>
                    <linearGradient id="spinGrad" x1="1" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#8b5cf6" />
                      <stop offset="100%" stopColor="#d946ef" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-2xl font-black text-violet-300">{progress}%</span>
                </div>
              </div>

              {/* Image Thumbnail */}
              {originalUrl && (
                <div className="relative w-36 h-36 rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-black/40">
                  <img src={originalUrl} alt="Processing" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <div className="absolute bottom-2 inset-x-0 flex justify-center gap-1">
                    {[0, 1, 2].map((i) => (
                      <span
                        key={i}
                        className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                        style={{ animationDelay: `${i * 0.15}s` }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Progress Bar */}
              <div className="w-full max-w-sm space-y-2">
                <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-violet-500 to-fuchsia-500 transition-all duration-500"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="text-center text-sm text-white/50">{progressLabel}</p>
              </div>

              <p className="text-white/25 text-xs text-center">
                First run downloads AI model (~35MB). Subsequent runs use cache.
              </p>
            </div>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === "error" && (
          <div className="rounded-3xl bg-red-500/5 border border-red-500/20 p-12 text-center">
            <div className="flex flex-col items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/20 flex items-center justify-center">
                <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h3 className="text-xl font-bold text-red-300 mb-2">Oops! Something went wrong</h3>
                <p className="text-white/40 text-sm">{errorMsg}</p>
              </div>
              <button
                onClick={handleReset}
                className="px-6 py-3 rounded-xl bg-white/[0.07] hover:bg-white/[0.12] border border-white/10 transition-colors text-sm font-semibold"
              >
                ← Try Again
              </button>
            </div>
          </div>
        )}

        {/* ── DONE: Result ── */}
        {stage === "done" && resultUrl && (
          <div className="space-y-5">
            {/* Action Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                onClick={handleReset}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.1] border border-white/[0.08] transition-colors text-sm font-medium"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m0 14v1m8-8h1M3 12H2m15.657-5.657l.707-.707M5.636 18.364l-.707.707M18.364 18.364l.707.707M5.636 5.636l-.707-.707" />
                </svg>
                New Image
              </button>
              <div className="flex gap-2.5">
                <button
                  onClick={handleDownloadPng}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/[0.06] hover:bg-white/[0.12] border border-white/[0.08] transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  PNG (Transparent)
                </button>
                <button
                  onClick={handleDownloadWithBg}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500 transition-all text-sm font-bold shadow-lg shadow-violet-500/20"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download with BG
                </button>
              </div>
            </div>

            {/* Result Card */}
            <div className="rounded-3xl bg-white/[0.03] border border-white/[0.07] overflow-hidden">
              {/* Toolbar */}
              <div className="px-6 py-4 border-b border-white/[0.07] flex flex-wrap items-center gap-5">
                {/* BG Picker */}
                <div className="flex items-center gap-3 flex-1 flex-wrap">
                  <span className="text-xs font-semibold uppercase tracking-wider text-white/30">Background</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {BG_OPTIONS.map((bg) => (
                      <button
                        key={bg.value}
                        title={bg.label}
                        onClick={() => setSelectedBg(bg)}
                        className={`w-7 h-7 rounded-lg transition-all duration-150 hover:scale-110 flex items-center justify-center ${
                          selectedBg.value === bg.value
                            ? "ring-2 ring-offset-1 ring-violet-400 ring-offset-[#0a0a12] scale-110"
                            : "hover:ring-1 hover:ring-white/30"
                        }`}
                        style={bg.value !== "transparent" ? { backgroundColor: bg.value } : {}}
                      >
                        {bg.value === "transparent" && (
                          <div className="w-full h-full rounded-lg overflow-hidden" style={{
                            backgroundImage: "linear-gradient(45deg,#555 25%,transparent 25%),linear-gradient(-45deg,#555 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#555 75%),linear-gradient(-45deg,transparent 75%,#555 75%)",
                            backgroundSize: "6px 6px",
                            backgroundPosition: "0 0,0 3px,3px -3px,-3px 0",
                            backgroundColor: "#888",
                          }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Compare Toggle */}
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/30">Compare</span>
                  <button
                    onClick={() => setShowComparison(!showComparison)}
                    className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${showComparison ? "bg-violet-500" : "bg-white/15"}`}
                  >
                    <span
                      className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform duration-200 shadow-sm ${showComparison ? "translate-x-5" : ""}`}
                    />
                  </button>
                </div>
              </div>

              {/* Preview Area */}
              <div className={`p-6 ${showComparison ? "grid sm:grid-cols-2 gap-6" : "flex justify-center items-center"}`}>
                {showComparison && originalUrl && (
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 text-center">
                      Original
                    </p>
                    <div className="rounded-2xl overflow-hidden border border-white/[0.07] bg-white/5">
                      <img
                        src={originalUrl}
                        alt="Original"
                        className="w-full max-h-[500px] object-contain"
                      />
                    </div>
                  </div>
                )}

                <div className={`space-y-2 ${showComparison ? "" : "max-w-lg w-full"}`}>
                  {showComparison && (
                    <p className="text-[10px] font-bold uppercase tracking-widest text-white/25 text-center">
                      Result
                    </p>
                  )}
                  <div
                    className="rounded-2xl overflow-hidden border border-white/[0.07] flex items-center justify-center min-h-64"
                    style={{
                      backgroundColor: selectedBg.value !== "transparent" ? selectedBg.value : undefined,
                      backgroundImage: selectedBg.value === "transparent"
                        ? "linear-gradient(45deg,#1e1e2e 25%,transparent 25%),linear-gradient(-45deg,#1e1e2e 25%,transparent 25%),linear-gradient(45deg,transparent 75%,#1e1e2e 75%),linear-gradient(-45deg,transparent 75%,#1e1e2e 75%)"
                        : undefined,
                      backgroundSize: "24px 24px",
                      backgroundPosition: "0 0,0 12px,12px -12px,-12px 0",
                      ...(selectedBg.value === "transparent" ? { backgroundColor: "#13131f" } : {}),
                    }}
                  >
                    <img
                      src={resultUrl}
                      alt="Result"
                      className="max-h-[500px] object-contain"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Success Line */}
            <div className="flex items-center justify-center gap-2 text-green-400/80 text-sm">
              <svg className="w-4 h-4 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
              Background removed successfully! Choose a background color and download.
            </div>
          </div>
        )}

        {/* ── Feature Cards (only idle) ── */}
        {stage === "idle" && (
          <div className="mt-16 grid grid-cols-1 sm:grid-cols-3 gap-5">
            {[
              {
                emoji: "🤖",
                title: "AI-Powered Precision",
                desc: "Advanced ONNX neural network removes backgrounds with pixel-perfect accuracy on any subject.",
              },
              {
                emoji: "🔒",
                title: "Your Data Stays Private",
                desc: "100% browser-based processing. Your photos never leave your device or hit any server.",
              },
              {
                emoji: "🎨",
                title: "Custom Backgrounds",
                desc: "Download as transparent PNG or apply any color background before exporting your image.",
              },
            ].map((card) => (
              <div
                key={card.title}
                className="p-6 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/5 transition-all duration-300 group"
              >
                <div className="text-3xl mb-4">{card.emoji}</div>
                <h3 className="font-bold text-white/90 mb-2 group-hover:text-violet-300 transition-colors">{card.title}</h3>
                <p className="text-white/40 text-sm leading-relaxed">{card.desc}</p>
              </div>
            ))}
          </div>
        )}

        {/* ── How it works ── */}
        {stage === "idle" && (
          <div className="mt-16">
            <h2 className="text-center text-2xl font-bold text-white/80 mb-10">How it works</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { step: "01", title: "Upload", desc: "Drag & drop or click to select any JPG, PNG or WEBP image." },
                { step: "02", title: "AI Removes BG", desc: "Our AI model analyzes your image and removes the background in seconds." },
                { step: "03", title: "Download", desc: "Pick a background color or keep it transparent, then download your result." },
              ].map((s) => (
                <div key={s.step} className="flex gap-4 items-start">
                  <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-violet-600/30 to-fuchsia-600/30 border border-violet-500/20 flex items-center justify-center text-xs font-black text-violet-400">
                    {s.step}
                  </div>
                  <div>
                    <h3 className="font-bold text-white/80 mb-1">{s.title}</h3>
                    <p className="text-white/40 text-sm leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="relative z-10 mt-24 border-t border-white/[0.05] py-8">
        <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-white/25 text-xs">
          <p>© 2025 BgRemover · Powered by IMG.LY Background Removal AI</p>
          <p>Free · Private · No watermarks</p>
        </div>
      </footer>
    </div>
  );
}
