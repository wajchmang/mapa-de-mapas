/**
 * Utility module to parse KML and GeoJSON files dropped into the app
 */
const GeoJsonParser = {
    /**
     * Parse KML text to GeoJSON/JS Place objects
     */
    parseKML(kmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kmlText, 'text/xml');
        const placemarks = xmlDoc.getElementsByTagName('Placemark');
        const places = [];

        for (let i = 0; i < placemarks.length; i++) {
            const pm = placemarks[i];
            const nameEl = pm.getElementsByTagName('name')[0];
            const descEl = pm.getElementsByTagName('description')[0];
            const coordsEl = pm.getElementsByTagName('coordinates')[0];

            const name = nameEl ? nameEl.textContent.trim() : `Lugar ${i + 1}`;
            const description = descEl ? descEl.textContent.trim() : '';

            if (coordsEl) {
                const coordsStr = coordsEl.textContent.trim();
                const parts = coordsStr.split(',');
                if (parts.length >= 2) {
                    const lng = parseFloat(parts[0]);
                    const lat = parseFloat(parts[1]);
                    if (!isNaN(lat) && !isNaN(lng)) {
                        places.push({
                            id: `imported-${Date.now()}-${i}`,
                            name,
                            category: 'Importado',
                            address: 'Ubicación importada',
                            lat,
                            lng,
                            description: description || 'Lugar importado desde archivo KML',
                            photo: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800'
                        });
                    }
                }
            }
        }
        return places;
    },

    /**
     * Parse GeoJSON object
     */
    parseGeoJSON(geoJsonObject) {
        if (!geoJsonObject || geoJsonObject.type !== 'FeatureCollection') {
            return [];
        }

        return geoJsonObject.features.map((feature, i) => {
            const props = feature.properties || {};
            const coords = feature.geometry ? feature.geometry.coordinates : [0, 0];
            return {
                id: props.id || `imported-geojson-${Date.now()}-${i}`,
                name: props.name || props.title || `Lugar ${i + 1}`,
                category: props.category || 'Importado',
                address: props.address || 'Ubicación en el mapa',
                lat: coords[1],
                lng: coords[0],
                description: props.description || 'Importado desde GeoJSON',
                photo: props.photo || 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800'
            };
        });
    }
};
