/** UV polygon geometry shared by the runtime, author tool and Node verifier.
 * Rings are open (the closing first vertex is implicit). Boundary counts as
 * contained. No convexity assumption is made. All tolerances are in UV units. */
export const GEOMETRY_EPSILON = 1e-9;
export const isUV = point => !!point && Number.isFinite(point.u) && Number.isFinite(point.v) && point.u >= 0 && point.u <= 1 && point.v >= 0 && point.v <= 1;
const cross = (a, b, c) => (b.u - a.u) * (c.v - a.v) - (b.v - a.v) * (c.u - a.u);
const same = (a, b) => Math.hypot(a.u - b.u, a.v - b.v) <= GEOMETRY_EPSILON;

export function pointOnSegment(point, a, b, epsilon = GEOMETRY_EPSILON) {
  const length = Math.hypot(b.u - a.u, b.v - a.v);
  if (length <= epsilon) return Math.hypot(point.u - a.u, point.v - a.v) <= epsilon;
  if (Math.abs(cross(a, b, point)) > epsilon * length) return false;
  return point.u >= Math.min(a.u, b.u) - epsilon && point.u <= Math.max(a.u, b.u) + epsilon && point.v >= Math.min(a.v, b.v) - epsilon && point.v <= Math.max(a.v, b.v) + epsilon;
}

export function segmentsIntersect(a, b, c, d) {
  if (pointOnSegment(a, c, d) || pointOnSegment(b, c, d) || pointOnSegment(c, a, b) || pointOnSegment(d, a, b)) return true;
  return (cross(a, b, c) > 0) !== (cross(a, b, d) > 0) && (cross(c, d, a) > 0) !== (cross(c, d, b) > 0);
}

export function pointInPolygon(point, polygon) {
  if (!isUV(point) || !Array.isArray(polygon) || polygon.length < 3 || !polygon.every(isUV)) return false;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[j], b = polygon[i];
    if (pointOnSegment(point, a, b)) return true;
    if ((a.v > point.v) !== (b.v > point.v) && point.u < (b.u - a.u) * (point.v - a.v) / (b.v - a.v) + a.u) inside = !inside;
  }
  return inside;
}

export function signedArea(polygon) {
  return polygon.reduce((sum, a, i) => { const b = polygon[(i + 1) % polygon.length]; return sum + a.u * b.v - b.u * a.v; }, 0) / 2;
}

/** Return indexed, actionable errors rather than silently repairing the ring. */
export function validatePolygon(polygon) {
  if (!Array.isArray(polygon) || polygon.length < 3) return [{ code: 'vertex-count', message: '多边形至少需要 3 个顶点', vertex: 0 }];
  if (polygon.length > 256) return [{ code: 'vertex-count', message: '单个多边形最多 256 个顶点', vertex: 256 }];
  const errors = [];
  polygon.forEach((point, vertex) => { if (!isUV(point)) errors.push({ code: 'uv-range', message: `第 ${vertex + 1} 个顶点必须为 0–1 之间的有限 UV`, vertex }); });
  if (errors.length) return errors;
  for (let i = 0; i < polygon.length; i++) {
    const next = (i + 1) % polygon.length;
    if (same(polygon[i], polygon[next])) errors.push({ code: 'duplicate-vertex', message: `第 ${i + 1} 条边长度为零（首点无需重复闭合）`, vertex: i });
    // Adjacent edges may meet, but may not double back over each other.
    const previous = (i + polygon.length - 1) % polygon.length;
    if (pointOnSegment(polygon[previous], polygon[i], polygon[next]) || pointOnSegment(polygon[next], polygon[previous], polygon[i])) {
      if (!same(polygon[previous], polygon[i]) && !same(polygon[i], polygon[next])) errors.push({ code: 'overlapping-edge', message: `第 ${i + 1} 个顶点相邻边折返重叠`, vertex: i });
    }
    for (let j = i + 1; j < polygon.length; j++) {
      if (j === next || (i === 0 && j === polygon.length - 1)) continue;
      if (segmentsIntersect(polygon[i], polygon[next], polygon[j], polygon[(j + 1) % polygon.length])) errors.push({ code: 'self-intersection', message: `第 ${i + 1} 与 ${j + 1} 条边相交`, vertex: i, otherVertex: j });
    }
  }
  if (Math.abs(signedArea(polygon)) <= 1e-8) errors.push({ code: 'zero-area', message: '多边形面积过小或为零', vertex: 0 });
  return errors;
}

/** Containment includes every edge segment, not only vertices: an edge can
 * bridge the missing part of a concave parent while both endpoints are inside. */
export function polygonInPolygon(polygon, parent) {
  if (validatePolygon(polygon).length || validatePolygon(parent).length || !polygon.every(point => pointInPolygon(point, parent))) return false;
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i], b = polygon[(i + 1) % polygon.length], cuts = [0, 1];
    const dx = b.u - a.u, dy = b.v - a.v;
    for (let j = 0; j < parent.length; j++) {
      const c = parent[j], d = parent[(j + 1) % parent.length];
      const ex = d.u - c.u, ey = d.v - c.v, denominator = dx * ey - dy * ex;
      if (Math.abs(denominator) > GEOMETRY_EPSILON) {
        const t = ((c.u - a.u) * ey - (c.v - a.v) * ex) / denominator;
        const s = ((c.u - a.u) * dy - (c.v - a.v) * dx) / denominator;
        if (t > 0 && t < 1 && s >= 0 && s <= 1) cuts.push(t);
      } else {
        for (const point of [c, d]) if (pointOnSegment(point, a, b)) cuts.push(Math.abs(dx) > Math.abs(dy) ? (point.u - a.u) / dx : (point.v - a.v) / dy);
      }
    }
    cuts.sort((x, y) => x - y);
    for (let j = 1; j < cuts.length; j++) {
      const t = (cuts[j - 1] + cuts[j]) / 2;
      if (!pointInPolygon({ u: a.u + t * dx, v: a.v + t * dy }, parent)) return false;
    }
  }
  return true;
}

export function polygonCentroid(polygon) {
  if (!polygon.length) return { u: 0.5, v: 0.5 };
  return { u: polygon.reduce((sum, point) => sum + point.u, 0) / polygon.length, v: polygon.reduce((sum, point) => sum + point.v, 0) / polygon.length };
}
