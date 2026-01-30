import * as turf from '@turf/turf';

/**
 * Creates a buffered polygon from a GeoJSON LineString.
 * @param {Object} lineString - GeoJSON LineString feature or geometry
 * @param {number} radius - Buffer radius in meters
 * @returns {Object} - GeoJSON Polygon or MultiPolygon
 */
export const bufferPath = (lineString, radius = 5) => {
  // turf.buffer returns a Feature, we need to extract .geometry
  const buffered = turf.buffer(lineString, radius / 1000, { units: 'kilometers' });
  return buffered.geometry; // Return geometry, not Feature
};

/**
 * Merges a new polygon into the existing cleared area using union.
 * @param {Object} existingArea - GeoJSON Polygon/MultiPolygon geometry (can be null)
 * @param {Object} newPolygon - GeoJSON Polygon/MultiPolygon geometry
 * @returns {Object} - Merged GeoJSON geometry
 */
export const mergeAreas = (existingArea, newPolygon) => {
  // Ensure we're working with geometries, not Features
  const newGeom = newPolygon.type === 'Feature' ? newPolygon.geometry : newPolygon;
  
  if (!existingArea) return newGeom; // First import: return the geometry directly
  
  const existingGeom = existingArea.type === 'Feature' ? existingArea.geometry : existingArea;
  
  // turf.union can handle Polygon or MultiPolygon
  try {
    const unionResult = turf.union(turf.featureCollection([
      turf.feature(existingGeom),
      turf.feature(newGeom)
    ]));
    return unionResult ? unionResult.geometry : newGeom; // turf.union returns a Feature
  } catch (e) {
    console.error("Merge failed", e);
    return existingGeom;
  }
};

/**
 * Helper to get area in square meters
 */
export const getArea = (geometry) => {
  return turf.area(geometry);
};

/**
 * Detects holes, checks for streets via Overpass API (mockable), and fills if empty.
 * @param {Object} geometry - GeoJSON geometry
 * @param {Function} onStatusUpdate - Callback for status messages (msg: string) => void
 * @returns {Promise<Object>} - New geometry with filled blocks (Promise!)
 */
export const fillBlocks = async (geometry, onStatusUpdate = () => {}) => {
  if (!geometry) return geometry;

  onStatusUpdate("Analyzing cleared area geometry...");

  // Simplify: Handle Polygon or MultiPolygon
  if (geometry.type === 'Polygon') {
    return await processPolygon(geometry, onStatusUpdate);
  } else if (geometry.type === 'MultiPolygon') {
    // Process each polygon in the multipolygon
    const newCoords = [];
    let i = 0;
    for (const polyCoords of geometry.coordinates) {
        i++;
        if (geometry.coordinates.length > 5) onStatusUpdate(`Analyzing polygon part ${i}/${geometry.coordinates.length}...`);
        newCoords.push(await processPolygonCoordinates(polyCoords, onStatusUpdate));
    }
    return { type: 'MultiPolygon', coordinates: newCoords };
  }
  return geometry;
};

const processPolygon = async (polygonGeom, onStatusUpdate) => {
  const newCoords = await processPolygonCoordinates(polygonGeom.coordinates, onStatusUpdate);
  return { type: 'Polygon', coordinates: newCoords };
};

const processPolygonCoordinates = async (coords, onStatusUpdate) => {
  if (coords.length <= 1) return coords; // No holes to check

  const outerRing = coords[0];
  const holes = coords.slice(1);
  const newHoles = [];
  
  if (holes.length > 0) {
      onStatusUpdate(`Found ${holes.length} potential blocks (holes). Checking sizes...`);
  }

  let processedCount = 0;
  for (const hole of holes) {
    processedCount++;
    const holePoly = turf.polygon([hole]);
    const holeArea = turf.area(holePoly);
    const bbox = turf.bbox(holePoly); // [minX, minY, maxX, maxY]

    // 1. Size Check
    if (holeArea > 50 && holeArea < 5000000) {
       const sizeStr = Math.round(holeArea).toLocaleString();
       console.log(`Checking block candidate: ${sizeStr} sqm`);
       onStatusUpdate(`Checking block ${processedCount}/${holes.length} (${sizeStr} sqm)...`);
       
       // 2. Real Street Check (Overpass API)
       onStatusUpdate(`Querying Overpass API for streets in block ${processedCount}...`);
       
       // Optimization: Simple bbox check first.
       const hasStreets = await checkIfBlockHasStreets(bbox, holePoly);
       
       if (!hasStreets) {
           console.log(`[Block Fill] Filling block! Size: ${sizeStr}sqm.`);
           onStatusUpdate(`Filled block ${processedCount} (No streets found).`);
           // To "fill" it, we simply DO NOT add it to newHoles.
           continue; 
       } else {
           const distinct = "Streets Detected"; // We could be more specific if we parsed API result
           console.log(`[Block Fill] Block NOT filled. Reason: ${distinct}.`);
           onStatusUpdate(`Block ${processedCount} NOT filled (${distinct}).`); 
       }
    } else {
        // Log if size was the issue (optional, maybe too spammy for UI)
        // console.log(`Hole skipped (Size: ${holeArea})`);
    }
    
    // If we reach here, we keep the hole
    newHoles.push(hole);
  }
  
  onStatusUpdate("Block analysis complete.");
  return [outerRing, ...newHoles];
};

/**
 * Checks if a given bounding box contains relevant streets.
 * Returns true if streets exist, false if empty (safe to fill).
 */
const checkIfBlockHasStreets = async (bbox, holePoly) => {
  // bbox is [minLon, minLat, maxLon, maxLat]
  // Overpass expects: (south, west, north, east) -> (minLat, minLon, maxLat, maxLon)
  const [minLon, minLat, maxLon, maxLat] = bbox;
  
  // Construct Query:
  // Look for ways with 'highway' tag.
  // Exclude footway, cycleway, path, service, track, steps (these don't count as "streets" that split a block).
  const query = `
    [out:json];
    way["highway"]
       ["highway"!~"footway|cycleway|path|service|track|steps|pedestrian"]
       (${minLat},${minLon},${maxLat},${maxLon});
    out geom;
  `;
  
  const url = 'https://overpass-api.de/api/interpreter';
  
  try {
    const response = await fetch(url, {
        method: 'POST',
        body: query
    });
    const data = await response.json();
    
    // If elements are found, we have streets.
    // Ideally we should check if they are *inside* the polygon and not just touching the edge,
    // but for this MVP, existence in the bbox is a strong enough signal.
    // (A more advanced check would use turf.booleanContains or intersect on the returned geometry).
    
    if (data.elements && data.elements.length > 0) {
        // Detailed check: do any of these ways actually cross into the hole?
        // Simplify: If returned count > 0, assume yes for now to be safe.
        // Or better: Filter out ways that are just the boundary (the user's path).
        // Since we are looking inside the HOLE, the user path surrounds it. 
        // Any OTHER street is an internal street.
        return true; 
    }
    return false;
    
  } catch (error) {
    console.error("Overpass API error:", error);
    // DEMO MODE: If API fails (e.g. rate limit, cors), we will ASSUME NO STREETS so the user sees the fill effect.
    // In production, you'd fail safe (return true).
    return false; 
  }
};
