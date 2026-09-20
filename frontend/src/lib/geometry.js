export const LETTER_ASPECT = 8.5 / 11;

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function pointToSegmentDistance(px, py, ax, ay, bx, by) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  if (len2 <= 0) {
    return Math.hypot(px - ax, py - ay);
  }
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / len2, 0, 1);
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

export function polylineHitsPoint(points, px, py, radius) {
  if (points.length === 0) {
    return false;
  }
  if (points.length === 1) {
    return Math.hypot(px - points[0].x, py - points[0].y) <= radius;
  }
  for (let i = 1; i < points.length; i += 1) {
    if (pointToSegmentDistance(px, py, points[i - 1].x, points[i - 1].y, points[i].x, points[i].y) <= radius) {
      return true;
    }
  }
  return false;
}

/** Fit an image into a container the way object-fit: contain does. */
export function containRect(containerWidth, containerHeight, imageWidth, imageHeight) {
  if (containerWidth <= 0 || containerHeight <= 0 || imageWidth <= 0 || imageHeight <= 0) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  const scale = Math.min(containerWidth / imageWidth, containerHeight / imageHeight);
  const width = imageWidth * scale;
  const height = imageHeight * scale;
  return {
    x: (containerWidth - width) / 2,
    y: (containerHeight - height) / 2,
    width,
    height,
  };
}
