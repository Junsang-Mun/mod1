# WebGPU Water Flow Simulation

A real-time water flow simulation using WebGPU for hardware-accelerated physics and rendering.

## Features

- Terrain rendering from .mod1 files
- Dynamic water simulation
- Responsive canvas that adjusts to window size
- Interactive camera controls
- Multiple simulation modes

## Usage

### Local Development

Start the development server:

```bash
./start-dev-server.sh
```

Or using Docker:

```bash
make build
make up
```

Access the application at http://localhost:8081 when using Docker or http://localhost:8000 when using the development server.

### Loading Terrain

1. Click "Load .mod1 file" and select a .mod1 file from the assets directory
2. The terrain will be loaded and displayed with proper height-based coloring

### Controls

- **Camera Controls**:
  - **Arrow Keys**: Rotate camera (left/right) and zoom (up/down)
  - **WASD**: Move camera horizontally
  - **Q/E**: Move camera vertically
  - **Right-click and drag**: Camera rotation
  
- **Simulation Modes**:
  - Select from dropdown to choose terrain modification or water addition
  - Left-click on the terrain to interact based on selected mode

## Responsive Design

The application features a fully responsive canvas that:

- Dynamically resizes with the browser window
- Maintains proper aspect ratio
- Updates WebGPU context and viewports automatically
- Recalculates projection matrices for correct rendering
- Works on both desktop and mobile devices
- Handles orientation changes on mobile devices

## Implementation Details

- WebGPU is used for hardware-accelerated rendering
- Camera projection updates maintain correct aspect ratio
- ResizeObserver monitors DOM size changes
- Device pixel ratio is considered for high-DPI displays
- Depth textures are recreated when canvas size changes
- Event listeners for window resize and orientation change ensure proper updates