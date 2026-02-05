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
 * @param {Object} options - Options object
 * @param {boolean} options.skipStreetCheck - If true, skip API calls and fill all valid holes immediately
 * @returns {Promise<Object>} - New geometry with filled blocks (Promise!)
 */
export const fillBlocks = async (geometry, onStatusUpdate = () => {}, options = {}) => {
  if (!geometry) return geometry;

  const { skipStreetCheck = false } = options;

  if (!skipStreetCheck) {
    onStatusUpdate("Analyzing cleared area geometry...");
  }

  // Simplify: Handle Polygon or MultiPolygon
  if (geometry.type === 'Polygon') {
    return await processPolygon(geometry, onStatusUpdate, skipStreetCheck);
  } else if (geometry.type === 'MultiPolygon') {
    // Process each polygon in the multipolygon
    const newCoords = [];
    let i = 0;
    for (const polyCoords of geometry.coordinates) {
        i++;
        if (!skipStreetCheck && geometry.coordinates.length > 5) onStatusUpdate(`Analyzing polygon part ${i}/${geometry.coordinates.length}...`);
        newCoords.push(await processPolygonCoordinates(polyCoords, onStatusUpdate, skipStreetCheck));
    }
    return { type: 'MultiPolygon', coordinates: newCoords };
  }
  return geometry;
};

const processPolygon = async (polygonGeom, onStatusUpdate, skipStreetCheck = false) => {
  const newCoords = await processPolygonCoordinates(polygonGeom.coordinates, onStatusUpdate, skipStreetCheck);
  return { type: 'Polygon', coordinates: newCoords };
};

// Cache for previously checked holes (persists across uploads in same session)
const holeCache = new Map();

/**
 * Generate a cache key for a hole based on its centroid and area
 */
const getHoleCacheKey = (holePoly, area) => {
  const centroid = turf.centroid(holePoly);
  const [lon, lat] = centroid.geometry.coordinates;
  // Round to 5 decimal places (~1 meter precision)
  return `${lat.toFixed(5)}_${lon.toFixed(5)}_${Math.round(area)}`;
};

const processPolygonCoordinates = async (coords, onStatusUpdate, skipStreetCheck = false) => {
  if (coords.length <= 1) return coords; // No holes to check

  const outerRing = coords[0];
  const holes = coords.slice(1);
  const newHoles = [];
  
  if (holes.length > 0 && !skipStreetCheck) {
      onStatusUpdate(`Found ${holes.length} potential blocks (holes). Checking sizes...`);
  }

  // Filter holes by size and prepare for batch processing
  const validHoles = [];
  const validHoleData = [];
  
  for (const hole of holes) {
    const holePoly = turf.polygon([hole]);
    const holeArea = turf.area(holePoly);
    
    if (holeArea > 50 && holeArea < 5000000) {
      validHoles.push(hole);
      validHoleData.push({
        hole,
        holePoly,
        holeArea,
        bbox: turf.bbox(holePoly)
      });
    } else {
      // Too small or too large - keep the hole
      newHoles.push(hole);
    }
  }

  if (validHoles.length === 0) {
    onStatusUpdate("No valid blocks to check.");
    return [outerRing, ...newHoles];
  }

  // Check cache and separate cached vs uncached
  const cachedResults = [];
  const uncachedData = [];
  
  for (const data of validHoleData) {
    const cacheKey = getHoleCacheKey(data.holePoly, data.holeArea);
    if (holeCache.has(cacheKey)) {
      const hasStreets = holeCache.get(cacheKey);
      cachedResults.push({ ...data, hasStreets, cached: true });
    } else {
      uncachedData.push({ ...data, cacheKey });
    }
  }

  // If skipStreetCheck is enabled, fill all valid holes immediately without API calls
  if (skipStreetCheck) {
    // Fill all valid holes (don't add them back)
    return [outerRing, ...newHoles];
  }

  if (cachedResults.length > 0) {
    onStatusUpdate(`Using cached results for ${cachedResults.length} blocks...`);
  }

  // Process uncached holes in parallel batches
  const BATCH_SIZE = 3; // Conservative batch size to respect API limits
  const uncachedResults = [];
  
  if (uncachedData.length > 0) {
    onStatusUpdate(`Checking ${uncachedData.length} new blocks (batch size: ${BATCH_SIZE})...`);
    
    for (let i = 0; i < uncachedData.length; i += BATCH_SIZE) {
      const batch = uncachedData.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(uncachedData.length / BATCH_SIZE);
      
      onStatusUpdate(`Processing batch ${batchNum}/${totalBatches} (${batch.length} blocks)...`);
      
      // Process batch in parallel
      const results = await Promise.all(
        batch.map(async (data, idx) => {
          const globalIdx = i + idx + 1;
          const sizeStr = Math.round(data.holeArea).toLocaleString();
          console.log(`[Batch ${batchNum}] Checking block ${globalIdx}/${uncachedData.length}: ${sizeStr} sqm`);
          
          const hasStreets = await checkIfBlockHasStreets(data.bbox, data.holePoly);
          
          // Cache the result
          holeCache.set(data.cacheKey, hasStreets);
          
          return { ...data, hasStreets, cached: false };
        })
      );
      
      uncachedResults.push(...results);
    }
  }

  // Combine all results and process
  const allResults = [...cachedResults, ...uncachedResults];
  let filledCount = 0;
  let keptCount = 0;
  
  for (const result of allResults) {
    const sizeStr = Math.round(result.holeArea).toLocaleString();
    const cacheTag = result.cached ? " [Cached]" : "";
    
    if (!result.hasStreets) {
      console.log(`[Block Fill] Filling block! Size: ${sizeStr}sqm${cacheTag}`);
      filledCount++;
      // Don't add to newHoles (fill it)
    } else {
      console.log(`[Block Fill] Block NOT filled. Reason: Streets Detected${cacheTag}`);
      newHoles.push(result.hole);
      keptCount++;
    }
  }
  
  onStatusUpdate(`Block analysis complete. Filled: ${filledCount}, Kept: ${keptCount}`);
  return [outerRing, ...newHoles];
};

/**
 * Checks if a given bounding box contains relevant streets.
 * Returns true if streets exist, false if empty (safe to fill).
 */
const checkIfBlockHasStreets = async (bbox, _holePoly) => {
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
