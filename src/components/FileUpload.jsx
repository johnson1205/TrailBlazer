import React, { useRef } from 'react';
import * as toGeoJSON from '@mapbox/togeojson'; // using the scoped package

const FileUpload = ({ onFileLoaded }) => {
  const fileInputRef = useRef(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      let text = event.target.result;
      
      // FIX: Some GPX generators (like Hiking Biji) use https for the namespace, 
      // but the standard and togeojson expect http. We normalize it here.
      text = text.replace(/xmlns="https:\/\/www\.topografix\.com\/GPX\/1\/1"/g, 'xmlns="http://www.topografix.com/GPX/1/1"');

      try {
          const parser = new DOMParser();
          const xmlDoc = parser.parseFromString(text, "text/xml"); // Parse XML (now normalized)
          
          let geoJson;
          if (file.name.toLowerCase().endsWith('.gpx')) {
            geoJson = toGeoJSON.gpx(xmlDoc);
          } else if (file.name.toLowerCase().endsWith('.kml')) {
            geoJson = toGeoJSON.kml(xmlDoc);
          } else {
            // Fallback for .xml or others
            geoJson = toGeoJSON.gpx(xmlDoc);
          }
    
          if (geoJson) {
            onFileLoaded(geoJson);
          }
      } catch (e) {
          console.error("Error parsing GPX:", e);
          // We can't easily bubble this error up without changing props, but console log helps.
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="file-input-wrapper">
      <input
        type="file"
        accept=".gpx,.xml"
        onChange={handleFileChange}
        style={{ display: 'none' }}
        ref={fileInputRef}
      />
      <button 
        className="ui-btn" 
        onClick={() => fileInputRef.current.click()}
      >
        Upload GPX Track
      </button>
    </div>
  );
};

export default FileUpload;
