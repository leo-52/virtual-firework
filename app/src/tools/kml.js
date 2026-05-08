// Parser KML — extrait les Placemark (Point, Polygon, LineString) pour
// positionner un spectacle sur le globe.

const PARSER = typeof DOMParser !== "undefined" ? new DOMParser() : null;

export function parseKml(text) {
  if (!PARSER) throw new Error("DOMParser indisponible.");
  const doc = PARSER.parseFromString(text, "application/xml");
  const errs = doc.querySelector("parsererror");
  if (errs) throw new Error("KML invalide : " + errs.textContent.slice(0, 200));

  const placemarks = [];
  for (const pm of doc.querySelectorAll("Placemark")) {
    const name = textOf(pm.querySelector("name")) || "Placemark sans nom";
    const desc = textOf(pm.querySelector("description")) || "";
    const point = pm.querySelector("Point coordinates");
    const polygon = pm.querySelector("Polygon outerBoundaryIs LinearRing coordinates");
    const line = pm.querySelector("LineString coordinates");
    if (point) {
      const coords = parseCoords(point.textContent);
      const [lon, lat, alt] = coords[0] || [];
      placemarks.push({ kind: "point", name, description: desc, lon, lat, alt });
    } else if (polygon) {
      placemarks.push({
        kind: "polygon", name, description: desc,
        coords: parseCoords(polygon.textContent),
      });
    } else if (line) {
      placemarks.push({
        kind: "line", name, description: desc,
        coords: parseCoords(line.textContent),
      });
    }
  }

  return {
    name: textOf(doc.querySelector("Document > name")) || "Document KML",
    placemarks,
    center: computeCenter(placemarks),
  };
}

function textOf(node) {
  return node ? node.textContent.trim() : "";
}

function parseCoords(raw) {
  if (!raw) return [];
  const out = [];
  for (const tok of raw.trim().split(/\s+/)) {
    const parts = tok.split(",").map(Number);
    if (parts.length >= 2 && parts.every((n) => Number.isFinite(n))) {
      out.push([parts[0], parts[1], parts[2] || 0]);
    }
  }
  return out;
}

function computeCenter(placemarks) {
  let sumLon = 0, sumLat = 0, n = 0;
  for (const pm of placemarks) {
    if (pm.kind === "point" && Number.isFinite(pm.lon) && Number.isFinite(pm.lat)) {
      sumLon += pm.lon; sumLat += pm.lat; n++;
    } else if (pm.coords) {
      for (const [lon, lat] of pm.coords) { sumLon += lon; sumLat += lat; n++; }
    }
  }
  return n ? { lon: sumLon / n, lat: sumLat / n } : null;
}
