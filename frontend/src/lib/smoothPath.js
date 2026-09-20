/**
 * Mid-point quadratic smoothing.
 * Q control = current point, end = midpoint to the next point.
 */
export function pointsToSvgPath(points) {
  if (points.length === 0) {
    return "";
  }

  const first = points[0];

  if (points.length === 1) {
    return `M ${first.x} ${first.y} L ${first.x} ${first.y}`;
  }

  if (points.length === 2) {
    const second = points[1];
    return `M ${first.x} ${first.y} L ${second.x} ${second.y}`;
  }

  let d = `M ${first.x} ${first.y}`;

  for (let i = 1; i < points.length - 1; i += 1) {
    const current = points[i];
    const next = points[i + 1];
    const midX = (current.x + next.x) / 2;
    const midY = (current.y + next.y) / 2;
    d += ` Q ${current.x} ${current.y} ${midX} ${midY}`;
  }

  const last = points[points.length - 1];
  d += ` L ${last.x} ${last.y}`;
  return d;
}
