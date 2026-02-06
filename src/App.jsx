import React, { useState } from 'react';
import MapComponent from './components/MapContainer';
import FileUpload from './components/FileUpload';
import { bufferPath, mergeAreas, fillBlocks } from './utils/GeometryEngine';
import * as turf from '@turf/turf';

function App() {
  const [clearedArea, setClearedArea] = useState(null);
  const [mapCenter, setMapCenter] = useState(null);
  const [statusMessage, setStatusMessage] = useState("Upload a GPX file to start.");
  // Add a version key to force map re-renders because sometimes deep GeoJSON changes aren't detected by key={JSON.stringify}
  const [mapKey, setMapKey] = useState(0);
  const [isDrawing, setIsDrawing] = useState(false);
  const [isGPS, setIsGPS] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(window.innerWidth > 768); // Open by default on desktop
  const [progress, setProgress] = useState(0);

  // Callback for status updates from child components
  const handleStatusUpdate = (msg, percent = 0) => {
    setStatusMessage(msg);
    setProgress(percent);
  };

  // Callback for DrawControl to update cleared area in real-time
  const handleDrawUpdate = (newGeometry) => {
    setClearedArea(newGeometry);
    setMapKey(prev => prev + 1);
  };

  const handleFileLoaded = async (geoJson, fileType = 'gpx') => {
    setStatusMessage("Processing track geometry...");
    
    // Handle GeoJSON (saved progress) differently
    if (fileType === 'geojson') {
      try {
        // Extract geometry from the first feature
        let importedGeometry = null;
        
        if (geoJson.type === 'FeatureCollection' && geoJson.features.length > 0) {
          const feature = geoJson.features[0];
          if (feature.geometry && (feature.geometry.type === 'Polygon' || feature.geometry.type === 'MultiPolygon')) {
            importedGeometry = feature.geometry;
          }
        }
        
        if (!importedGeometry) {
          setStatusMessage("Invalid GeoJSON format. Expected Polygon or MultiPolygon.");
          return;
        }
        
        // Merge with existing cleared area
        const merged = clearedArea ? mergeAreas(clearedArea, importedGeometry) : importedGeometry;
        
        console.log('Imported GeoJSON geometry:', importedGeometry.type);
        console.log('Merged with existing area');
        
        // Update map
        setClearedArea(merged);
        setMapKey(prev => prev + 1);
        
        setStatusMessage("Progress loaded successfully! Upload more tracks to continue exploring.");
        
        // Auto-trigger block filling
        setTimeout(async () => {
          try {
            const filled = await fillBlocks(merged, (msg) => {
              setStatusMessage(msg);
            });
            
            const newRef = JSON.parse(JSON.stringify(filled));
            setClearedArea(newRef);
            setMapKey(prev => prev + 1);
            
            setStatusMessage("Loaded area re-scanned and updated.");
          } catch (e) {
            console.error("Error filling blocks:", e);
            setStatusMessage("Progress loaded. Error re-scanning blocks.");
          }
        }, 1000);
        
        return;
      } catch (e) {
        console.error("GeoJSON import error:", e);
        setStatusMessage("Error importing GeoJSON file.");
        return;
      }
    }
    
    // Process GPX files (original logic)
    let newPathPolygon = null;
    let featureCount = 0;
    const typesFound = new Set();
    const waypoints = []; // Collect waypoints (Point features)

    turf.featureEach(geoJson, (currentFeature) => {
      featureCount++;
      if(currentFeature.geometry) typesFound.add(currentFeature.geometry.type);
      
      // Collect Point features (waypoints)
      if (currentFeature.geometry.type === 'Point') {
          waypoints.push(currentFeature.geometry.coordinates);
      }
      
      // Support both LineString and MultiLineString
      if (currentFeature.geometry.type === 'LineString' || currentFeature.geometry.type === 'MultiLineString') {
        const buffered = bufferPath(currentFeature, 15); // Fixed 15m radius as requested
        
        if (newPathPolygon) {
            newPathPolygon = mergeAreas(newPathPolygon, buffered);
        } else {
            newPathPolygon = buffered;
        }
        
        // Update center to start of track
        if (!mapCenter) {
             const coords = currentFeature.geometry.coordinates;
             // Handle simple LineString or MultiLineString (array of lines)
             const firstPoint = currentFeature.geometry.type === 'LineString' ? coords[0] : coords[0][0];
             if (firstPoint) {
                 const [lon, lat] = firstPoint;
                 setMapCenter([lat, lon]);
             }
        }
      }
    });

    // Convert waypoints to LineString if we have them but no tracks
    if (waypoints.length > 0 && !newPathPolygon) {
        console.log(`Converting ${waypoints.length} waypoints to LineString...`);
        setStatusMessage(`Converting ${waypoints.length} waypoints to track...`);
        
        // Create a LineString from the waypoints
        const lineString = turf.lineString(waypoints);
        const buffered = bufferPath(lineString, 15);
        newPathPolygon = buffered;
        
        // Set map center to first waypoint
        if (!mapCenter && waypoints.length > 0) {
            const [lon, lat] = waypoints[0];
            setMapCenter([lat, lon]);
        }
    }

    // Debug logging
    console.log(`GPX Parse Result: ${featureCount} features found`);
    console.log(`Geometry types: ${Array.from(typesFound).join(', ')}`);
    console.log(`Valid track found: ${newPathPolygon ? 'YES' : 'NO'}`);

    if (newPathPolygon) {
      const merged = mergeAreas(clearedArea, newPathPolygon);
      
      // Debug: Log the merged geometry structure
      console.log('Merged geometry type:', merged.type);
      console.log('Merged geometry:', merged);
      if (merged.type === 'Polygon') {
          console.log('Polygon has', merged.coordinates.length, 'rings (1 outer + holes)');
      } else if (merged.type === 'MultiPolygon') {
          console.log('MultiPolygon has', merged.coordinates.length, 'polygons');
      }
      
      // STEP 1: Show the UNFILLED track immediately (User feedback)
      setClearedArea(merged);
      setMapKey(prev => prev + 1); // Force render
      
      // AUTO-TRIGGER: Run the City Block Filling logic
      setStatusMessage("Track visible. Checking for closed loops in 1 second...");
      
      setTimeout(async () => {
        try {
            const filled = await fillBlocks(merged, (msg) => {
                setStatusMessage(msg); // Real-time progress updates
            });
            
            // STEP 2: Show the FILLED track
            const newRef = JSON.parse(JSON.stringify(filled));
            setClearedArea(newRef);
            setMapKey(prev => prev + 1); // Force render again
            
            setStatusMessage("Processing complete. Blocks filled if streets not found.");
        } catch (e) {
            console.error("Error filling blocks:", e);
            // No need to reset clearedArea, it's already 'merged'
            setStatusMessage("Track uploaded. Error checking blocks (network issue?).");
        }
      }, 1000);
      
    } else {
        const typeList = Array.from(typesFound).join(", ");
        const tailMsg = featureCount === 0 
            ? "File may be empty or have parsing errors." 
            : `Found ${featureCount} feature(s) of type: ${typeList || 'NONE'}`;
            
        setStatusMessage(`No valid tracks found. ${tailMsg}`);
        console.error(`Import failed: ${tailMsg}`);
    }
  };
      

  
  // We can keep this for manual re-scans if needed, or remove. 
  // User asked for "progress like requesting api" on upload, implies auto.
  // I'll keep it as a utility but the main flow is now automatic.
  const handleScanBlocks = async () => {
    if (!clearedArea) {
        setStatusMessage("No cleared area to scan.");
        return;
    }
    
    setStatusMessage("Re-scanning for closed loops...");
    
    try {
        const filled = await fillBlocks(clearedArea, (msg) => {
            setStatusMessage(msg);
        });
        setClearedArea(filled);
        setStatusMessage("Scan complete.");
    } catch (e) {
        console.error("Error filling blocks:", e);
        setStatusMessage("Error checking blocks.");
    }
  };

  const handleExport = () => {
    if (!clearedArea) {
      setStatusMessage("No explored area to export.");
      return;
    }
    
    try {
      // Create GeoJSON Feature with metadata
      const feature = {
        type: "Feature",
        properties: {
          exportDate: new Date().toISOString(),
          appVersion: "1.1",
          description: "TrailBlazer - Cleared Area"
        },
        geometry: clearedArea
      };
      
      // Download as file
      const blob = new Blob([JSON.stringify(feature, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `trailblazer-${Date.now()}.geojson`;
      a.click();
      URL.revokeObjectURL(url);
      
      setStatusMessage("Progress saved successfully!");
    } catch (e) {
      console.error("Export error:", e);
      setStatusMessage("Error exporting progress.");
    }
  };

  const handleClear = () => {
    setClearedArea(null);
    setStatusMessage("Map cleared.");
  };

  return (
    <div className="app-container">
      <MapComponent 
        clearedArea={clearedArea} 
        center={mapCenter} 
        processKey={mapKey} 
        isDrawing={isDrawing}
        isGPS={isGPS}
        onDrawUpdate={handleDrawUpdate}
        onStatusUpdate={handleStatusUpdate}
      />
      
      <div className={`ui-drawer ${isMenuOpen ? 'open' : ''}`}>
        <div className="drawer-header">
           <h1 className="ui-title">TrailBlazer</h1>
           <button className="close-btn" onClick={() => setIsMenuOpen(false)}>✕</button>
        </div>
        
        <p style={{fontSize: '0.8rem', color: '#aaa', marginBottom: '0.5rem'}}>
          {statusMessage}
        </p>

        {progress > 0 && progress < 100 && (
            <div style={{width: '100%', background: 'rgba(255,255,255,0.1)', height: '6px', borderRadius: '3px', overflow: 'hidden', marginBottom: '1rem'}}>
               <div style={{width: `${progress}%`, background: '#10b981', height: '100%', transition: 'width 0.3s ease'}}></div>
            </div>
        )}
        
        <FileUpload onFileLoaded={handleFileLoaded} />
        
        <button 
            className="ui-btn" 
            style={{backgroundColor: '#10b981', marginTop: '0.5rem'}}
            onClick={handleScanBlocks}
            disabled={!clearedArea}
        >
          Re-Scan Blocks
        </button>
        
        <button 
            className="ui-btn" 
            style={{backgroundColor: '#3b82f6', marginTop: '0.5rem'}}
            onClick={handleExport}
            disabled={!clearedArea}
        >
          💾 Save Progress
        </button>
        
        <button 
            className="ui-btn" 
            style={{backgroundColor: isDrawing ? '#ef4444' : '#f97316', marginTop: '0.5rem'}}
            onClick={() => {
              if (isGPS) setIsGPS(false);
              setIsDrawing(!isDrawing);
              setStatusMessage(isDrawing ? "Draw mode OFF." : "Draw mode ON. Long-press (0.5s) then drag to draw.");
              if (window.innerWidth < 768) setIsMenuOpen(false); // Auto-close on mobile
            }}
        >
          {isDrawing ? '🛑 Stop Drawing' : '✏️ Draw Path'}
        </button>
        
        <button className="ui-btn secondary" onClick={handleClear}>
          Reset Map
        </button>
        
        <div style={{marginTop: '1rem', fontSize: '0.75rem', color: '#666'}}>
            <p>1. Upload GPX/XML/GeoJSON track.</p>
            <p>2. Or click "✏️ Draw Path", long-press + drag.</p>
            <p>3. Path is buffered (15m) & cleared.</p>
            <p>4. Blocks auto-fill when you complete a loop.</p>
            <p>5. Save progress to continue later.</p>
        </div>
      </div>

      <button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)}>
        ☰
      </button>

      <button 
        className={`gps-fab ${isGPS ? 'active' : ''}`}
        onClick={() => {
            if (isDrawing) setIsDrawing(false); 
            setIsGPS(!isGPS);
            setStatusMessage(isGPS ? "GPS Tracking OFF." : "GPS Tracking ON. Walk to explore!");
        }}
        title="Toggle GPS Tracking"
      >
        <span className="gps-icon">{isGPS ? '🛑' : '📍'}</span>
        <span className="gps-text">{isGPS ? 'Stop GPS' : 'Start GPS'}</span>
      </button>

    </div>
  );
}


export default App;
