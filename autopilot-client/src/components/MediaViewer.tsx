import { useState } from "react";
import { ChevronLeft, ChevronRight, X, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent } from "@/components/ui/sheet";

interface MediaViewerProps {
  mediaUrl: string;
  mediaType: string;
  open: boolean;
  onClose: () => void;
}

const MediaViewer = ({ mediaUrl, mediaType, open, onClose }: MediaViewerProps) => {
  const [currentSlide, setCurrentSlide] = useState(0);

  if (mediaType === "slideshow") {
    let slides: string[] = [];
    try {
      slides = JSON.parse(mediaUrl);
    } catch {
      return null;
    }

    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="h-[90vh] max-w-4xl mx-auto p-0 overflow-hidden bg-black/95 border-border/30">
          <div className="relative flex flex-col items-center">
            {/* Close */}
            <Button
              variant="ghost"
              size="sm"
              className="absolute top-3 right-3 z-10 text-white/70 hover:text-white hover:bg-white/10"
              onClick={onClose}
            >
              <X className="h-5 w-5" />
            </Button>

            {/* Slide counter */}
            <div className="absolute top-3 left-3 z-10 text-white/70 text-sm font-medium bg-black/50 px-3 py-1 rounded-full">
              {currentSlide + 1} / {slides.length}
            </div>

            {/* Main slide */}
            <div className="relative w-full flex items-center justify-center min-h-[400px] max-h-[70vh]">
              <img
                src={slides[currentSlide]}
                alt={`Slide ${currentSlide + 1}`}
                className="max-w-full max-h-[70vh] object-contain"
              />

              {/* Nav arrows */}
              {slides.length > 1 && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute left-2 text-white/70 hover:text-white hover:bg-white/10 h-10 w-10 p-0 rounded-full"
                    onClick={() => setCurrentSlide((p) => (p - 1 + slides.length) % slides.length)}
                  >
                    <ChevronLeft className="h-6 w-6" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-2 text-white/70 hover:text-white hover:bg-white/10 h-10 w-10 p-0 rounded-full"
                    onClick={() => setCurrentSlide((p) => (p + 1) % slides.length)}
                  >
                    <ChevronRight className="h-6 w-6" />
                  </Button>
                </>
              )}
            </div>

            {/* Thumbnail strip */}
            <div className="flex gap-2 p-4 overflow-x-auto w-full justify-center">
              {slides.map((url, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentSlide(i)}
                  className={`shrink-0 rounded-lg overflow-hidden border-2 transition-all ${
                    i === currentSlide ? "border-primary scale-105" : "border-transparent opacity-60 hover:opacity-90"
                  }`}
                >
                  <img src={url} alt={`Thumb ${i + 1}`} className="h-16 w-24 object-cover" />
                </button>
              ))}
            </div>
          </div>
        </SheetContent>
      </Sheet>
    );
  }

  if (mediaType === "video") {
    return (
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent side="bottom" className="h-auto max-w-4xl mx-auto p-2 bg-black/95 border-border/30">
          <video src={mediaUrl} className="w-full max-h-[75vh]" controls autoPlay />
        </SheetContent>
      </Sheet>
    );
  }

  // Single image
  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent side="bottom" className="h-auto max-w-4xl mx-auto p-2 bg-black/95 border-border/30">
        <img src={mediaUrl} alt="Media" className="w-full max-h-[75vh] object-contain" />
      </SheetContent>
    </Sheet>
  );
};

// Inline trigger button for content cards
export const MediaViewerTrigger = ({
  mediaUrl,
  mediaType,
}: {
  mediaUrl: string;
  mediaType: string;
}) => {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        className="h-7 text-xs gap-1"
        onClick={() => setOpen(true)}
      >
        <Maximize2 className="h-3 w-3" /> View
      </Button>
      <MediaViewer
        mediaUrl={mediaUrl}
        mediaType={mediaType}
        open={open}
        onClose={() => setOpen(false)}
      />
    </>
  );
};

export default MediaViewer;
