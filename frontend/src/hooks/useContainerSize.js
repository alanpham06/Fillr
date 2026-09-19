import { useEffect, useState } from "react";

/**
 * Track a container's content-box size. Batches ResizeObserver
 * callbacks on animation frames so react-pdf is not redrawn every pixel.
 */
export function useContainerSize(ref) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    const node = ref.current;
    if (!node) {
      return undefined;
    }

    let frame = 0;

    const publish = (width, height) => {
      const nextWidth = Math.max(0, Math.floor(width));
      const nextHeight = Math.max(0, Math.floor(height));
      setSize((prev) => {
        if (prev.width === nextWidth && prev.height === nextHeight) {
          return prev;
        }
        return { width: nextWidth, height: nextHeight };
      });
    };

    const read = (entry) => {
      const box = entry?.contentBoxSize?.[0];
      if (box) {
        return { width: box.inlineSize, height: box.blockSize };
      }
      if (entry) {
        return { width: entry.contentRect.width, height: entry.contentRect.height };
      }
      return { width: node.clientWidth, height: node.clientHeight };
    };

    const observer = new ResizeObserver((entries) => {
      const { width, height } = read(entries[0]);
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => publish(width, height));
    });

    observer.observe(node);
    publish(node.clientWidth, node.clientHeight);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [ref]);

  return size;
}
