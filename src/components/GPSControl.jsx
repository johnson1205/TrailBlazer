import { useEffect, useRef, useCallback } from 'react';
import { useMap } from 'react-leaflet';
import L from 'leaflet';
import * as turf from '@turf/turf';
import { bufferPath, mergeAreas, fillBlocks } from '../utils/GeometryEngine';

/**
 * GPSControl - Enables real-time path drawing via GPS geolocation.
 * Mimics behavior of DrawControl but driven by watchPosition.
 */
const GPSControl = ({ onGPSUpdate, clearedArea, bufferRadius = 15 }) => {
  const map = useMap();
  const pathPointsRef = useRef([]);
  const polylineLayerRef = useRef(null);
  const locationMarkerRef = useRef(null);
  const lastUpdateTimeRef = useRef(0);
  const baseAreaRef = useRef(null);
  const watchIdRef = useRef(null);
  
  const UPDATE_THROTTLE_MS = 1000; // Update geometry every 1 second
  const MIN_DISTANCE_METERS = 5;   // Minimum distance to record a new point

  // Sync fill logic - reusable from DrawControl
  const processAndUpdate = useCallback(async (points, options = {}) => {
    if (points.length < 2) return;

    // Create a LineString from points
    const geoJsonCoords = points.map(p => [p[1], p[0]]);
    const lineString = turf.lineString(geoJsonCoords);
    
    // Buffer the path
    const buffered = bufferPath(lineString, bufferRadius);
    
    // Merge with BASE area (snapshot at start)
    const merged = mergeAreas(baseAreaRef.current, buffered);
    
    let finalGeometry = merged;

    // Only fill blocks if requested (on stop)
    if (options.shouldFill) {
        // Fill blocks. Default is strict check (skipStreetCheck: false)
        const fillOptions = { skipStreetCheck: false, ...options };
        finalGeometry = await fillBlocks(merged, () => {}, fillOptions);
    }
    
    // Update parent
    onGPSUpdate(finalGeometry);
  }, [bufferRadius, onGPSUpdate]);

  // Throttled update
  const throttledUpdate = useCallback((points) => {
    const now = Date.now();
    if (now - lastUpdateTimeRef.current >= UPDATE_THROTTLE_MS) {
      lastUpdateTimeRef.current = now;
      processAndUpdate([...points], { shouldFill: false });
    }
  }, [processAndUpdate]);

  useEffect(() => {
    if (!map) return;

    // 1. Capture Base State
    baseAreaRef.current = clearedArea;

    // 2. Setup Visuals
    polylineLayerRef.current = L.polyline([], {
      color: '#3b82f6', // distinct blue for GPS
      weight: 5,
      opacity: 0.9
    }).addTo(map);

    locationMarkerRef.current = L.marker([0, 0], {
        // Simple circle marker
        icon: L.divIcon({
            className: 'gps-marker',
            html: '<div style="background-color: #3b82f6; width: 16px; height: 16px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 5px rgba(0,0,0,0.5);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        })
    }).addTo(map);

    // 3. Start Watching
    if ("geolocation" in navigator) {
      console.log("Starting GPS tracking...");
      
      watchIdRef.current = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude, accuracy } = position.coords;
            const newPoint = [latitude, longitude];
            const lastPoint = pathPointsRef.current[pathPointsRef.current.length - 1];

            // Update marker
            locationMarkerRef.current.setLatLng(newPoint);
            
            // Initial center
            if (pathPointsRef.current.length === 0) {
                map.setView(newPoint, 18);
            } else {
                // Pan map to keep user visible if near edge? Or just strict follow?
                // For now, strict follow if we want "navigation" mode, or let user pan.
                // Let's just pan if it's the first few points, then let user control.
                // Actually, standard behavior is usually "follow user".
                // map.panTo(newPoint); // User might fight this if they want to look around
            }

            // Filter noise: Check distance
            let shouldAdd = true;
            if (lastPoint) {
                const dist = map.distance(lastPoint, newPoint);
                if (dist < MIN_DISTANCE_METERS) shouldAdd = false;
            }

            if (shouldAdd) {
                pathPointsRef.current.push(newPoint);
                polylineLayerRef.current.setLatLngs(pathPointsRef.current);
                throttledUpdate(pathPointsRef.current);
            }
        },
        (error) => {
            console.error("GPS Error:", error);
            // Optionally notify parent of error
        },
        {
            enableHighAccuracy: true,
            maximumAge: 0,
            timeout: 5000
        }
      );
    } else {
        console.error("Geolocation not supported.");
    }

    // 4. Cleanup on Unmount (Stop GPS)
    return () => {
        if (watchIdRef.current !== null) {
            navigator.geolocation.clearWatch(watchIdRef.current);
        }
        
        // Final Strict Verification
        if (pathPointsRef.current.length >= 2) {
            // It's safe to call this async, but the component unmounts instantly.
            // It's safe to call this async, but the component unmounts instantly.
            // The callback might still fire if parent exists.
            processAndUpdate(pathPointsRef.current, { shouldFill: true, skipStreetCheck: false });
        }

        if (polylineLayerRef.current) {
            map.removeLayer(polylineLayerRef.current);
        }
        if (locationMarkerRef.current) {
            map.removeLayer(locationMarkerRef.current);
        }
        
        pathPointsRef.current = [];
        baseAreaRef.current = null;
    };
  }, [map, throttledUpdate, processAndUpdate]); 
  // IMPORTANT: Dependency on `map` only. `clearedArea` is captured once via ref logic (though useEffect runs when dependecies change). 
  // If `clearedArea` changes while GPS is running (e.g. file upload?), we ignore it? 
  // No, we want `baseAreaRef` to be the snapshot AT START. 
  // So `clearedArea` should NOT be in dependency array for the Setup effect.
  // But wait, React Hook lint might complain.
  // We can use a separate effect to set baseAreaRef if needed, but really we only want it ON MOUNT.

  return null;
};

export default GPSControl;
