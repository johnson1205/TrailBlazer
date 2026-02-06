# TrailBlazer - Explore the Real World

Turn your real-world adventures into an exploration game! Upload your GPS tracks and watch as you unveil the map, revealing the areas you've conquered. Challenge yourself to explore every street and fill in the gaps.

🌐 **[Play Now](https://johnson1205.github.io/TrailBlazer/)**

![TrailBlazer Demo](https://img.shields.io/badge/status-live-brightgreen)
![Version](https://img.shields.io/badge/version-1.3-blue)
![React](https://img.shields.io/badge/React-19.2.0-blue)
![Leaflet](https://img.shields.io/badge/Leaflet-1.9.4-green)

## 📋 Version History

### Version 1.3 (Current)
- 📍 **GPS Tracking Integration**: Real-time path drawing using device geolocation
- 📱 **Mobile Responsive Design**: New Collapsible Menu and FAB GPS button for better phone experience
- 🛡️ **Session Management**: STRICT verification ensures map accuracy when tracking stops
- 🔄 **Live Verification**: Auto-fill valid blocks as you physically circle them

### Version 1.2
- ✏️ **Manual Path Drawing**: Long-press and drag to draw paths manually on the map
- 🔄 **Real-time Auto-fill**: Visualize filled blocks instantly while drawing
- 🛡️ **Smart Verification**: Automatic background check verifies street existence after drawing
- 👆 **Long-Press Interaction**: Improved touch/mouse interaction to prevent accidental dragging

### Version 1.1
- 💾 **Save Your Progress**: Export and reload your exploration journey
- ⚡ **Faster Exploration**: 3x faster area discovery with smart caching
- 📍 **Waypoint Adventures**: Turn any GPS waypoints into exploration paths
- 🎮 **Better Feedback**: Enhanced game-like status updates

### Version 1.0
- 🗺️ **Map Unveiling**: Reveal areas as you explore
- 🎯 **Smart Block Filling**: Automatically claim enclosed territories
- 📁 **GPS Track Import**: Upload your adventures
- 🌐 **Real-time Discovery**: Live street detection system


## 🎮 Game Features

### 🏃 Your Exploration Journey
- **Multiple Adventure Formats**: Import GPS tracks or waypoints from your real-world journeys
- **Save Your Progress**: Export your conquered territories and continue later
- **Path Conversion**: Waypoints automatically connect into exploration routes
- **Smart Territory Claiming**: 15-meter radius around your path becomes yours
- **Multi-Session Adventures**: Build your explored world across multiple trips

### 🗺️ Intelligent Territory Expansion
- **Auto-Discovery**: Enclosed areas are automatically detected
- **Street Verification**: Real-time checks to see if you've surrounded a city block
- **Smart Claiming**: Only claim blocks you've truly surrounded (no streets inside)
- **Live Updates**: Watch your progress as the game analyzes your routes
- **Parallel Processing**: Discover 3x faster with batch territory checks
- **Memory System**: Previously checked areas are instantly validated

### 💾 Progress Management
- **Export Adventures**: Download your explored map as a shareable file
- **Resume Anytime**: Load your saved progress and continue exploring
- **Incremental Growth**: Add new adventures to your existing map
- **Standard Format**: Compatible with mapping tools (QGIS, ArcGIS, etc.)


### 🎨 Interactive Game Map
- **OpenStreetMap Base**: High-quality world map
- **Live Updates**: Watch territories unveil in real-time
- **Clear Visualization**: See exactly what you've conquered
- **Responsive Play**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites
- Node.js 16+ and npm

### Installation

```bash
# Clone the repository
git clone https://github.com/johnson1205/TrailBlazer.git
cd TrailBlazer

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

## 🎯 How to Play

1. **Upload Your Adventure**: Click "Upload Track/Progress" and select your GPS track file
2. **Watch the Map Unveil**: The game will:
   - Process your journey
   - Claim a 15m radius around your path
   - Detect any enclosed territories
   - Check for streets inside (using OpenStreetMap)
   - Automatically claim empty blocks you've surrounded
3. **Save Your Progress**: Click "💾 Save Progress" to download your conquered map
4. **Continue Your Quest**: Upload the saved file to resume your exploration
5. **Expand Your Territory**: Add more GPS tracks to grow your explored world
6. **Re-scan**: Click "Re-Scan Blocks" to re-analyze your territories

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
TrailBlazer/
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

The app will be available at `https://[username].github.io/TrailBlazer/`

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
