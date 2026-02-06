import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { bufferPath, mergeAreas, fillBlocks } from '../utils/GeometryEngine';

/**
 * DrawControl - Enables drawing paths on the map by long-press + drag.
 * Long-press (500ms) activates drawing mode, then drag to draw.
 * As the user draws, closed loops are auto-filled in real-time.
 */
const DrawControl = ({ onDrawUpdate, clearedArea, bufferRadius = 15 }) => {
  const map = useMap();
  const isDrawingRef = useRef(false);
  const isLongPressRef = useRef(false);
  const longPressTimerRef = useRef(null);
  const pathPointsRef = useRef([]);
  const polylineLayerRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const handlersRef = useRef({}); // Store handlers for proper cleanup
  const baseAreaRef = useRef(null); // Store the initial area before drawing starts

  
  const UPDATE_THROTTLE_MS = 100;
  const LONG_PRESS_DURATION_MS = 500;

  // Sync fill logic - run fill and update parent state
  // Sync fill logic - run fill and update parent state
  const processAndUpdate = useCallback(async (points, options = {}) => {
    if (points.length < 2) return;

    // Create a LineString from points (points are [lat, lng], need to convert to [lng, lat] for GeoJSON)
    const geoJsonCoords = points.map(p => [p[1], p[0]]);
    const lineString = turf.lineString(geoJsonCoords);
    
    // Buffer the path
    const buffered = bufferPath(lineString, bufferRadius);
    
    // Merge with BASE area (snapshot at drag start)
    const merged = mergeAreas(baseAreaRef.current, buffered);
    
    let finalGeometry = merged;

    // Only fill blocks if requested (on mouseup/stop)
    if (options.shouldFill) {
        // Fill blocks. Default is strict check (skipStreetCheck: false), but can be overridden.
        const fillOptions = { skipStreetCheck: false, ...options };
        finalGeometry = await fillBlocks(merged, () => {}, fillOptions);
    }
    
    // Update parent
    onDrawUpdate(finalGeometry);
  }, [bufferRadius, onDrawUpdate]); // removed clearedArea dependency

  // Throttled update during drag - FAST mode
  // Throttled update during drag - FAST mode (NO FILLING)
  const throttledUpdate = useCallback((points) => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE_MS) {
      lastUpdateTimeRef.current = now;
      processAndUpdate([...points], { shouldFill: false });
    }
  }, [processAndUpdate]);

  useEffect(() => {
    if (!map) return;

    const container = map.getContainer();

    // Create a temporary polyline layer for visual feedback during drawing
    polylineLayerRef.current = L.polyline([], {
      color: '#f97316',
      weight: 4,
      opacity: 0.8,
      dashArray: '5, 10'
    }).addTo(map);

    let startPoint = null;

    // Define handlers
    handlersRef.current.mousedown = (e) => {
      // Only left click
      if (e.button !== 0) return;

      // Capture the current clearedArea as the base for this drawing session
      baseAreaRef.current = clearedArea;
      
      startPoint = L.point(e.clientX, e.clientY);
      
      longPressTimerRef.current = setTimeout(() => {
        // Long press detected - switch to drawing mode
        isLongPressRef.current = true;
        isDrawingRef.current = true;
        
        // Disable map dragging NOW, not before
        map.dragging.disable();
        map.doubleClickZoom.disable();
        
        const latlng = map.mouseEventToLatLng(e);
        pathPointsRef.current = [[latlng.lat, latlng.lng]];
        polylineLayerRef.current.setLatLngs([[latlng.lat, latlng.lng]]);
        
        container.style.cursor = 'crosshair';
      }, LONG_PRESS_DURATION_MS);
    };

    handlersRef.current.mousemove = (e) => {
      // If waiting for long press...
      if (longPressTimerRef.current && !isDrawingRef.current) {
        const currentPoint = L.point(e.clientX, e.clientY);
        const distance = startPoint ? startPoint.distanceTo(currentPoint) : 0;
        
        // If moved significantly (> 10px) before timer fires, cancel long press
        if (distance > 10) {
          clearTimeout(longPressTimerRef.current);
          longPressTimerRef.current = null;
        }
        return;
      }
      
      if (!isDrawingRef.current) return;
      
      const latlng = map.mouseEventToLatLng(e);
      const newPoint = [latlng.lat, latlng.lng];
      pathPointsRef.current.push(newPoint);
      
      // Update visual polyline
      polylineLayerRef.current.setLatLngs(pathPointsRef.current);
      
      // Throttled geometry update
      throttledUpdate(pathPointsRef.current);
    };

    handlersRef.current.mouseup = async () => {
      // Clear long-press timer if pending
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
      
      if (!isDrawingRef.current) return;
      
      // Reset state
      isDrawingRef.current = false;
      isLongPressRef.current = false;
      startPoint = null;
      // Don't clear baseAreaRef yet, we need it for the final update call

      
      // Re-enable map features
      map.dragging.enable();
      map.doubleClickZoom.enable();
      container.style.cursor = '';
      
      // Final update with all points - STRICT mode (check streets) AND FILL
      if (pathPointsRef.current.length >= 2) {
        // Run strict check to verify and fill blocks
        await processAndUpdate(pathPointsRef.current, { shouldFill: true, skipStreetCheck: false });
      }
      
      // Reset visual line and local points
      polylineLayerRef.current.setLatLngs([]);
      pathPointsRef.current = [];
      baseAreaRef.current = null; // Clean up memory
    };

    handlersRef.current.mouseleave = (e) => {
        // Only stop if we are actually drawing vs just moving mouse out
        if (isDrawingRef.current) {
            handlersRef.current.mouseup(e);
        }
        // Also cancel timer if just hovering out
        if (longPressTimerRef.current) {
            clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    // Attach events to the map container (DOM events capture drag)
    container.addEventListener('mousedown', handlersRef.current.mousedown);
    container.addEventListener('mousemove', handlersRef.current.mousemove);
    container.addEventListener('mouseup', handlersRef.current.mouseup);
    container.addEventListener('mouseleave', handlersRef.current.mouseleave);

    // Initial Cleanup (just in case)
    map.dragging.enable();

    return () => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
      }
      
      map.dragging.enable();
      map.doubleClickZoom.enable();
      
      if (polylineLayerRef.current) {
        map.removeLayer(polylineLayerRef.current);
      }
      
      container.style.cursor = '';
      
      container.removeEventListener('mousedown', handlersRef.current.mousedown);
      container.removeEventListener('mousemove', handlersRef.current.mousemove);
      container.removeEventListener('mouseup', handlersRef.current.mouseup);
      container.removeEventListener('mouseleave', handlersRef.current.mouseleave);
    };
  }, [map, throttledUpdate, processAndUpdate]);

  return null; // This component doesn't render anything visible
};

export default DrawControl;
