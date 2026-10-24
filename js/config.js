const CONFIG = {
    // Map Engine settings (Leaflet + CartoDB Positron for clean free vector tiles)
    MAP_TILE_PROVIDER: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    MAP_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    
    // Default Map Center (Buenos Aires Obelisco)
    DEFAULT_CENTER: [-34.603722, -58.381592],
    DEFAULT_ZOOM: 12,
    
    // Sidebar Offset config (in pixels) for desktop
    SIDEBAR_WIDTH_OFFSET: 210, // Offset map center by half of 420px sidebar
};
