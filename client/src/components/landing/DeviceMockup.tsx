import { useLayoutEffect, useRef, useState } from 'react';
import { DeviceFrameset } from 'react-device-frameset';
import 'react-device-frameset/styles/marvel-devices.min.css';
import { cn } from '@/lib/utils';

export type MockupDevice = 'desktop' | 'tablet' | 'phone';

/**
 * Natural size of each frame (screen + bezel, plus anything that sticks out, like the
 * laptop's base), so the frame can be scaled to fit its container.
 * Screenshots are captured at the screen's shape: laptop 16:10, tablet 4:3 landscape,
 * phone 400×822.
 */
const FRAME_BOX: Record<MockupDevice, { width: number; height: number; offsetX: number }> = {
  desktop: { width: 1188, height: 720, offsetX: 70 },
  tablet: { width: 952, height: 626, offsetX: 2 },
  phone: { width: 424, height: 912, offsetX: 2 },
};

function Frame({ device, children }: { device: MockupDevice; children: React.ReactNode }) {
  if (device === 'desktop') return <DeviceFrameset device="MacBook Pro">{children}</DeviceFrameset>;
  if (device === 'tablet')
    return (
      <DeviceFrameset device="iPad Mini" color="black" landscape>
        {children}
      </DeviceFrameset>
    );
  return <DeviceFrameset device="Galaxy Note 8">{children}</DeviceFrameset>;
}

/** A screenshot shown inside a laptop, tablet or phone frame that scales to its container. */
export function DeviceMockup({
  device,
  className,
  children,
}: {
  device: MockupDevice;
  className?: string;
  /** What appears on the device's screen, usually an <img>. */
  children: React.ReactNode;
}) {
  const box = FRAME_BOX[device];
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = outerRef.current;
    if (!el) return;
    const measure = () => setScale(el.clientWidth / box.width);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [box.width]);

  return (
    <div
      ref={outerRef}
      className={cn('relative w-full', className)}
      // Reserve the frame's space before it is measured, so nothing jumps.
      style={{ aspectRatio: `${box.width} / ${box.height}` }}
    >
      <div
        className={cn('absolute top-0 transition-opacity duration-300', scale === null && 'opacity-0')}
        style={{
          left: (scale ?? 0) * box.offsetX,
          transform: `scale(${scale ?? 0})`,
          transformOrigin: 'top left',
        }}
      >
        <Frame device={device}>{children}</Frame>
      </div>
    </div>
  );
}
