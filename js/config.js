const CONFIG = {
    // Mapa de fondo: OpenFreeMap, estilo Positron (gratis, sin API key ni registro).
    // Reemplaza a CARTO, que desde agosto 2026 exige API key.
    MAP_STYLE_URL: 'https://tiles.openfreemap.org/styles/positron',
    MAP_ATTRIBUTION: '<a href="https://openfreemap.org" target="_blank">OpenFreeMap</a> &copy; <a href="https://www.openmaptiles.org/" target="_blank">OpenMapTiles</a> Datos de <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',

    // Plan B si el navegador no puede dibujar mapas vectoriales (sin WebGL)
    MAP_FALLBACK_TILES: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    MAP_FALLBACK_ATTRIBUTION: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a>',
    
    // Default Map Center (Buenos Aires Obelisco)
    DEFAULT_CENTER: [-34.603722, -58.381592],
    DEFAULT_ZOOM: 12,
    
    // Sidebar Offset config (in pixels) for desktop
    SIDEBAR_WIDTH_OFFSET: 210, // Offset map center by half of 420px sidebar
};
