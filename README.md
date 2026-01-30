# Fog of War - Real-World GPS Track Visualizer

A React-based web application that visualizes your real-world exploration using GPS tracks. Upload your GPX files and watch as the map reveals the areas you've explored, with intelligent "city block" filling for enclosed areas.

🌐 **[Live Demo](https://johnson1205.github.io/Fog_of_War/)**

![Fog of War Demo](https://img.shields.io/badge/status-live-brightgreen)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green)

## ✨ Features

### 📍 GPS Track Processing
- **Multiple Format Support**: Import GPX files containing tracks (`<trk>`) or waypoints (`<wpt>`)
- **Automatic Conversion**: Waypoints are automatically connected into continuous paths
- **Smart Buffering**: 15-meter radius buffer around your tracks for realistic coverage visualization
- **Multi-Track Support**: Upload multiple GPX files to build your exploration map over time

### 🗺️ Intelligent Block Filling
- **Automatic Detection**: Identifies enclosed areas (loops) in your tracks
- **Street Verification**: Queries OpenStreetMap via Overpass API to check for streets inside loops
- **Smart Filling**: Only fills blocks that don't contain streets, preserving realistic exploration patterns
- **Real-time Feedback**: Live status updates during processing ("Querying Overpass API for streets...")

### 🎨 Interactive Map
- **OpenStreetMap Integration**: High-quality, free map tiles
- **Dynamic Updates**: Map automatically refreshes as you upload new tracks
- **Visual Feedback**: Clear distinction between explored areas and fog of war
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/johnson1205/Fog_of_War.git
cd Fog_of_War

# Install dependencies
npm install

# Start development server
npm run dev
```

The app will open at `http://localhost:5173`

### Building for Production

```bash
# Build the app
npm run build

# Preview the production build
npm run preview
```

## 📖 Usage

1. **Upload a GPX File**: Click "Upload GPX Track" and select your GPS track file
2. **Watch the Magic**: The app will:
   - Parse your track data
   - Create a 15m buffer around your path
   - Detect any enclosed areas (loops)
   - Query OpenStreetMap to check for streets
   - Fill blocks that don't contain streets
3. **Add More Tracks**: Upload additional GPX files to expand your explored area
4. **Re-scan**: Click "Re-Scan Blocks" to manually re-trigger the block filling algorithm

## 🛠️ Technology Stack

### Core
- **React 19.2** - UI framework
- **Vite 7.2** - Build tool and dev server
- **Leaflet 1.9** - Interactive maps
- **React-Leaflet 5.0** - React bindings for Leaflet

### Geospatial Processing
- **Turf.js 7.3** - Geospatial analysis (buffering, union, area calculations)
- **@mapbox/togeojson** - GPX to GeoJSON conversion

### APIs
- **OpenStreetMap** - Free map tiles
- **Overpass API** - Real-time street data queries

## 📁 Project Structure

```
Fog_of_War/
├── src/
│   ├── App.jsx                 # Main application logic
│   ├── components/
│   │   ├── FileUpload.jsx      # GPX file upload handler
│   │   └── MapContainer.jsx    # Leaflet map component
│   ├── utils/
│   │   └── GeometryEngine.js   # Geospatial processing logic
│   └── index.css               # Global styles
├── public/
│   └── sample_track.gpx        # Example GPX file
└── package.json
```

## 🔧 Configuration

### Adjusting Buffer Radius
Edit `src/App.jsx` line 28:
```javascript
const buffered = bufferPath(currentFeature, 15); // Change 15 to your desired radius in meters
```

### Customizing Block Size Limits
Edit `src/utils/GeometryEngine.js` line 93:
```javascript
if (holeArea > 50 && holeArea < 5000000) { // Adjust min/max area in square meters
```

## 🌐 Deployment

This project is configured for GitHub Pages deployment:

```bash
# Deploy to GitHub Pages
npm run deploy
```

The app will be available at `https://[username].github.io/Fog_of_War/`

## 🐛 Known Limitations

- **Overpass API Rate Limits**: The free Overpass API has rate limits (~2 requests/second). Large files with many loops may trigger throttling.
- **Browser Performance**: Very large GPX files (>1000 points) may cause slowdowns during processing.
- **HTTPS Namespace Fix**: Some GPX generators use `https://` in the namespace, which is automatically normalized to `http://` for compatibility.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## 📄 License

This project is open source and available under the MIT License.

## 🙏 Acknowledgments

- OpenStreetMap contributors for map data
- Overpass API for street data queries
- Turf.js team for excellent geospatial tools
- Leaflet community for the mapping library

## 📧 Contact

For questions or feedback, please open an issue on GitHub.

---

**Built with ❤️ using React and OpenStreetMap**
