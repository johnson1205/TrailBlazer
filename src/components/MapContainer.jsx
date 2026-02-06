import React, { useEffect } from 'react';
import { MapContainer, TileLayer, GeoJSON, useMap, ScaleControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import DrawControl from './DrawControl';
import GPSControl from './GPSControl';

// Fix for Leaflet icons
import icon from 'leaflet/dist/images/marker-icon.png';
import iconShadow from 'leaflet/dist/images/marker-shadow.png';

let DefaultIcon = L.icon({
    iconUrl: icon,
    shadowUrl: iconShadow,
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

L.Marker.prototype.options.icon = DefaultIcon;

// Component to update center
const MapCenterUpdater = ({ center }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, map.getZoom());
    }
  }, [center, map]);
  return null;
};

// Component to fit bounds
const MapBoundsUpdater = ({ bounds }) => {
  const map = useMap();
  useEffect(() => {
    if (bounds && Object.keys(bounds).length > 0) {
      try {
        // Zoom in very close (maxZoom: 22) to see the 1 meter buffer
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 22 }); 
      } catch (e) {
        console.warn("Invalid bounds", e);
      }
    }
  }, [bounds, map]);
  return null;
};

const MapComponent = ({ clearedArea, center, processKey, isDrawing, isGPS, onDrawUpdate, onStatusUpdate }) => {
  const defaultCenter = [51.505, -0.09]; // London
  
  // Calculate bounds from GeoJSON if available
  let bounds = null;
  if (clearedArea) {
    try {
        // Create a temporary Leaflet GeoJSON layer to calculate bounds
        const layer = L.geoJSON(clearedArea);
        const bbox = layer.getBounds();
        if (bbox.isValid()) {
            bounds = bbox;
        }
    } catch (e) {
        console.error("Error calculating bounds from GeoJSON", e);
    }
  }

  // Style: No stroke (weight 0) to ensure user sees the "fill" (Polygon)
  // Logic: User complained they saw a "path line". A 1m buffer with a stroke looks like a line at low zoom.
  // By using fill-only + auto-zoom, it will look like a shape.
  const geoJsonStyle = {
    color: '#3b82f6', 
    weight: 1, // Minimal stroke to define edges if fill is faint, or 0.
    opacity: 0.5,
    fillColor: '#60a5fa',
    fillOpacity: 0.6
  };

  return (
    <div className="map-container">
      <MapContainer 
        center={center || defaultCenter} 
        zoom={13} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={false}
      >
        <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        
        {clearedArea && (
            <GeoJSON 
                key={processKey} // FORCE RE-MOUNT on logical partial updates
                data={clearedArea} 
                style={geoJsonStyle} 
            />
        )}
        
        {/* DrawControl for real-time path drawing */}
        {isDrawing && !isGPS && (
          <DrawControl 
            onDrawUpdate={onDrawUpdate} 
            onStatusUpdate={onStatusUpdate}
            clearedArea={clearedArea} 
            bufferRadius={15}
          />
        )}

        {/* GPSControl for real-time location tracking */}
        {isGPS && !isDrawing && (
          <GPSControl 
            onGPSUpdate={onDrawUpdate} 
            onStatusUpdate={onStatusUpdate}
            clearedArea={clearedArea} 
            bufferRadius={15}
          />
        )}
        
        {/* Only use one updater if possible to conflict. 
            If bounds exist (file loaded), use bounds. 
            Else use center (initial load or reset). */}
        {bounds ? <MapBoundsUpdater bounds={bounds} /> : <MapCenterUpdater center={center} />}
        <ScaleControl position="bottomleft" />
      </MapContainer>
    </div>
  );
};

export default MapComponent;

