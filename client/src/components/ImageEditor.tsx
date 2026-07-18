import { useState, useRef, useEffect, useCallback } from "react";
import { X, RotateCcw, Type, Contrast, Sun, Droplets, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface ImageEditorProps {
  imageUrl: string;
  open: boolean;
  onClose: () => void;
  onSave: (editedDataUrl: string) => void;
}

interface TextOverlay {
  text: string;
  x: number;
  y: number;
  fontSize: number;
  color: string;
}

const ImageEditor = ({ imageUrl, open, onClose, onSave }: ImageEditorProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [brightness, setBrightness] = useState(100);
  const [contrast, setContrast] = useState(100);
  const [saturation, setSaturation] = useState(100);
  const [textOverlays, setTextOverlays] = useState<TextOverlay[]>([]);
  const [newText, setNewText] = useState("");
  const [textColor, setTextColor] = useState("#ffffff");
  const [textSize, setTextSize] = useState(32);
  const [cropMode, setCropMode] = useState(false);
  const [cropStart, setCropStart] = useState<{ x: number; y: number } | null>(null);
  const [cropEnd, setCropEnd] = useState<{ x: number; y: number } | null>(null);
  const [cropApplied, setCropApplied] = useState<{ sx: number; sy: number; sw: number; sh: number } | null>(null);

  useEffect(() => {
    if (!imageUrl || !open) return;
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => setImg(image);
    image.src = imageUrl;
  }, [imageUrl, open]);

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const crop = cropApplied || { sx: 0, sy: 0, sw: img.width, sh: img.height };
    canvas.width = crop.sw;
    canvas.height = crop.sh;

    ctx.filter = `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
    ctx.drawImage(img, crop.sx, crop.sy, crop.sw, crop.sh, 0, 0, crop.sw, crop.sh);
    ctx.filter = "none";

    // Draw text overlays
    textOverlays.forEach((t) => {
      ctx.fillStyle = t.color;
      ctx.font = `bold ${t.fontSize}px 'Space Grotesk', sans-serif`;
      ctx.textAlign = "center";
      ctx.shadowColor = "rgba(0,0,0,0.5)";
      ctx.shadowBlur = 4;
      ctx.fillText(t.text, t.x * crop.sw, t.y * crop.sh);
      ctx.shadowBlur = 0;
    });

    // Draw crop selection
    if (cropMode && cropStart && cropEnd) {
      const x = Math.min(cropStart.x, cropEnd.x);
      const y = Math.min(cropStart.y, cropEnd.y);
      const w = Math.abs(cropEnd.x - cropStart.x);
      const h = Math.abs(cropEnd.y - cropStart.y);
      ctx.strokeStyle = "hsl(var(--primary))";
      ctx.lineWidth = 2;
      ctx.setLineDash([6, 3]);
      ctx.strokeRect(x, y, w, h);
      ctx.setLineDash([]);
      // Darken outside
      ctx.fillStyle = "rgba(0,0,0,0.4)";
      ctx.fillRect(0, 0, canvas.width, y);
      ctx.fillRect(0, y, x, h);
      ctx.fillRect(x + w, y, canvas.width - x - w, h);
      ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
    }
  }, [img, brightness, contrast, saturation, textOverlays, cropMode, cropStart, cropEnd, cropApplied]);

  useEffect(() => {
    drawCanvas();
  }, [drawCanvas]);

  const handleAddText = () => {
    if (!newText.trim()) return;
    setTextOverlays((prev) => [...prev, { text: newText, x: 0.5, y: 0.5, fontSize: textSize, color: textColor }]);
    setNewText("");
  };

  const handleCropMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    setCropStart({ x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
    setCropEnd(null);
  };

  const handleCropMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!cropMode || !cropStart || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const scaleX = canvasRef.current.width / rect.width;
    const scaleY = canvasRef.current.height / rect.height;
    setCropEnd({ x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY });
  };

  const handleCropMouseUp = () => {
    // Crop selection stays visible until applied
  };

  const applyCrop = () => {
    if (!cropStart || !cropEnd || !img) return;
    const prev = cropApplied || { sx: 0, sy: 0, sw: img.width, sh: img.height };
    const x = Math.min(cropStart.x, cropEnd.x);
    const y = Math.min(cropStart.y, cropEnd.y);
    const w = Math.abs(cropEnd.x - cropStart.x);
    const h = Math.abs(cropEnd.y - cropStart.y);
    setCropApplied({ sx: prev.sx + x, sy: prev.sy + y, sw: w, sh: h });
    setCropStart(null);
    setCropEnd(null);
    setCropMode(false);
  };

  const handleReset = () => {
    setBrightness(100);
    setContrast(100);
    setSaturation(100);
    setTextOverlays([]);
    setCropApplied(null);
    setCropStart(null);
    setCropEnd(null);
    setCropMode(false);
  };

  const handleSave = () => {
    if (!canvasRef.current) return;
    const dataUrl = canvasRef.current.toDataURL("image/png");
    onSave(dataUrl);
  };

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="right" className="w-full sm:max-w-3xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="font-display">Edit Image</SheetTitle>
        </SheetHeader>
        <div className="space-y-4">
          {/* Canvas */}
          <div className="relative border border-border rounded-lg overflow-hidden bg-muted flex items-center justify-center">
            <canvas
              ref={canvasRef}
              className="max-w-full max-h-[400px] object-contain cursor-crosshair"
              onMouseDown={handleCropMouseDown}
              onMouseMove={handleCropMouseMove}
              onMouseUp={handleCropMouseUp}
            />
          </div>

          {/* Filters */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Sun className="h-3 w-3" /> Brightness</Label>
              <Slider value={[brightness]} onValueChange={([v]) => setBrightness(v)} min={50} max={200} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Contrast className="h-3 w-3" /> Contrast</Label>
              <Slider value={[contrast]} onValueChange={([v]) => setContrast(v)} min={50} max={200} step={1} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs flex items-center gap-1"><Droplets className="h-3 w-3" /> Saturation</Label>
              <Slider value={[saturation]} onValueChange={([v]) => setSaturation(v)} min={0} max={200} step={1} />
            </div>
          </div>

          {/* Text Overlay */}
          <div className="flex items-end gap-2">
            <div className="flex-1 space-y-1">
              <Label className="text-xs flex items-center gap-1"><Type className="h-3 w-3" /> Text Overlay</Label>
              <Input value={newText} onChange={(e) => setNewText(e.target.value)} placeholder="Add text to image..." />
            </div>
            <Input type="color" value={textColor} onChange={(e) => setTextColor(e.target.value)} className="w-10 h-9 p-1 cursor-pointer" />
            <Input type="number" value={textSize} onChange={(e) => setTextSize(Number(e.target.value))} className="w-16 h-9" min={12} max={120} />
            <Button size="sm" onClick={handleAddText} variant="outline">Add</Button>
          </div>

          {textOverlays.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {textOverlays.map((t, i) => (
                <span key={i} className="text-xs bg-muted px-2 py-1 rounded flex items-center gap-1">
                  "{t.text}"
                  <button onClick={() => setTextOverlays((prev) => prev.filter((_, j) => j !== i))} className="text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <Button size="sm" variant={cropMode ? "default" : "outline"} onClick={() => setCropMode(!cropMode)}
                className={cropMode ? "" : ""}>
                {cropMode ? "Cancel Crop" : "Crop"}
              </Button>
              {cropMode && cropStart && cropEnd && (
                <Button size="sm" onClick={applyCrop} className="">
                  <Check className="mr-1 h-3 w-3" /> Apply Crop
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handleReset}>
                <RotateCcw className="mr-1 h-3 w-3" /> Reset
              </Button>
            </div>
            <Button onClick={handleSave} className="">
              Save Changes
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default ImageEditor;
