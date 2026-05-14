import { useState, useRef, useEffect, useCallback } from "react";

interface AvatarCropModalProps {
  imageFile: File;
  onCropped: (blob: Blob) => void;
  onCancel: () => void;
}

const PREVIEW_SIZE = 240;
const OUTPUT_SIZE = 512;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 4;

/**
 * Avatar cropper – WYSIWYG.
 * The user sees a circular preview at PREVIEW_SIZE px.
 * On save we re-draw the EXACT same framing into a OUTPUT_SIZE px canvas
 * (just scaled up by OUTPUT_SIZE/PREVIEW_SIZE) so the result === preview.
 */
const AvatarCropModal = ({ imageFile, onCropped, onCancel }: AvatarCropModalProps) => {
  const [imgSrc] = useState<string>(() => URL.createObjectURL(imageFile));
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [zoom, setZoom] = useState(1);
  // Offset in PREVIEW pixels from center of preview.
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const dragRef = useRef<{ active: boolean; startX: number; startY: number; baseX: number; baseY: number }>({
    active: false, startX: 0, startY: 0, baseX: 0, baseY: 0,
  });

  // Load image
  useEffect(() => {
    const i = new Image();
    i.onload = () => {
      setImg(i);
      // Initial zoom = "cover" the preview circle
      const z = Math.max(PREVIEW_SIZE / i.naturalWidth, PREVIEW_SIZE / i.naturalHeight);
      setZoom(z);
      setOffset({ x: 0, y: 0 });
    };
    i.src = imgSrc;
    return () => URL.revokeObjectURL(imgSrc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Render preview = source of truth for the final image
  const renderTo = useCallback((canvas: HTMLCanvasElement, size: number) => {
    if (!img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const ratio = size / PREVIEW_SIZE;
    canvas.width = size;
    canvas.height = size;
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, size, size);

    const drawW = img.naturalWidth * zoom * ratio;
    const drawH = img.naturalHeight * zoom * ratio;
    const cx = size / 2 + offset.x * ratio;
    const cy = size / 2 + offset.y * ratio;
    ctx.drawImage(img, cx - drawW / 2, cy - drawH / 2, drawW, drawH);
  }, [img, zoom, offset]);

  // Repaint preview whenever inputs change
  useEffect(() => {
    if (previewCanvasRef.current) renderTo(previewCanvasRef.current, PREVIEW_SIZE);
  }, [renderTo]);

  const handleCrop = () => {
    if (!img) return;
    const out = document.createElement("canvas");
    renderTo(out, OUTPUT_SIZE);
    out.toBlob((blob) => { if (blob) onCropped(blob); }, "image/jpeg", 0.95);
  };

  // Drag to pan
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, baseX: offset.x, baseY: offset.y };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setOffset({
      x: dragRef.current.baseX + (e.clientX - dragRef.current.startX),
      y: dragRef.current.baseY + (e.clientY - dragRef.current.startY),
    });
  };
  const onPointerUp = () => { dragRef.current.active = false; };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, zoom * (e.deltaY < 0 ? 1.06 : 0.94)));
    setZoom(next);
  };

  return (
    <div className="md-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) onCancel(); }}>
      <div className="md-modal" style={{ maxWidth: 380, padding: 24 }}>
        <button className="md-modal-close" onClick={onCancel}>✕</button>
        <div className="md-modal-title">📷 Zdjęcie profilowe</div>
        <div style={{ fontSize: ".75rem", color: "#8899b4", textAlign: "center", marginBottom: 12 }}>
          Przeciągnij aby przesunąć · Scroll aby przybliżyć
        </div>

        <canvas
          ref={previewCanvasRef}
          width={PREVIEW_SIZE}
          height={PREVIEW_SIZE}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onWheel={onWheel}
          style={{
            display: "block",
            width: PREVIEW_SIZE,
            height: PREVIEW_SIZE,
            borderRadius: "50%",
            margin: "8px auto 20px",
            border: "3px solid rgba(99, 102, 241, 0.5)",
            backgroundColor: "#000",
            cursor: "grab",
            touchAction: "none",
          }}
        />

        <div style={{ marginBottom: 24 }}>
          <label style={{ display: "block", fontSize: ".8rem", color: "#8899b4", marginBottom: 10 }}>
            Powiększenie: {zoom.toFixed(2)}x
          </label>
          <input
            type="range"
            min={MIN_ZOOM}
            max={MAX_ZOOM}
            step="0.01"
            value={zoom}
            onChange={(e) => setZoom(parseFloat(e.target.value))}
            style={{ width: "100%", accentColor: "#6366f1", cursor: "pointer" }}
          />
        </div>

        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="md-btn" onClick={onCancel}>Anuluj</button>
          <button className="md-btn md-btn-prim" onClick={handleCrop}>✓ Zapisz</button>
        </div>
      </div>
    </div>
  );
};

export default AvatarCropModal;
