/**
 * map-engine.js v5 — Leaflet, Clustering, Offset Panning, Mini Popups & User Location
 */
const MapEngine = {
    map: null,
    clusterGroup: null,
    markersMap: new Map(),
    userLocationMarker: null,

    init(elementId) {
        if (this.map) return;

        this.map = L.map(elementId, {
            zoomControl: false,
            attributionControl: false
        }).setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM);

        L.control.zoom({ position: 'topright' }).addTo(this.map);

        L.tileLayer(CONFIG.MAP_TILE_PROVIDER, {
            maxZoom: 19,
            attribution: CONFIG.MAP_ATTRIBUTION
        }).addTo(this.map);

        this.clusterGroup = L.markerClusterGroup({
            showCoverageOnHover: false,
            zoomToBoundsOnClick: true,
            maxClusterRadius: 40,
            iconCreateFunction: (cluster) => {
                const count = cluster.getChildCount();
                return L.divIcon({
                    html: `<div class="marker-cluster-custom">${count}</div>`,
                    className: 'custom-cluster-icon',
                    iconSize: [36, 36]
                });
            }
        });

        this.map.addLayer(this.clusterGroup);
    },

    renderPlaces(places, onPlaceClickCallback) {
        this.clearMarkers();
        if (!places || places.length === 0) return;

        const bounds = L.latLngBounds();

        places.forEach(place => {
            if (!place.lat || !place.lng) return;

            const iconHtml = this.getMarkerIconHtml(place.category);
            const customIcon = L.divIcon({
                html: iconHtml,
                className: 'custom-marker-wrapper',
                iconSize: [32, 32],
                iconAnchor: [16, 32],
                popupAnchor: [0, -36]
            });

            const marker = L.marker([place.lat, place.lng], { icon: customIcon });

            // Mini popup tooltip
            const popupHtml = `
                <div class="marker-popup-content">
                    <span class="popup-badge">${place.category}</span>
                    <h4 class="popup-title">${place.name}</h4>
                    <p class="popup-address">📍 ${place.address}</p>
                </div>
            `;
            marker.bindPopup(popupHtml, {
                closeButton: false,
                className: 'custom-leaflet-popup',
                maxWidth: 240
            });

            marker.on('click', () => {
                marker.openPopup();
                if (onPlaceClickCallback) onPlaceClickCallback(place);
            });

            this.clusterGroup.addLayer(marker);
            this.markersMap.set(place.id, marker);
            bounds.extend([place.lat, place.lng]);
        });

        if (places.length > 0) {
            this.fitBoundsWithOffset(bounds);
        }
    },

    panToPlace(place, zoomLevel = 15) {
        if (!this.map || !place.lat || !place.lng) return;

        this.map.setView([place.lat, place.lng], zoomLevel, { animate: true });

        const marker = this.markersMap.get(place.id);
        if (marker) {
            setTimeout(() => marker.openPopup(), 300);
        }

        // Sidebar offset (desktop)
        if (window.innerWidth > 768) {
            setTimeout(() => {
                this.map.panBy([-CONFIG.SIDEBAR_WIDTH_OFFSET, 0], { animate: true });
            }, 150);
        }
    },

    fitBoundsWithOffset(bounds) {
        if (!bounds.isValid()) return;
        const isDesktop = window.innerWidth > 768;
        this.map.fitBounds(bounds, {
            paddingTopLeft: [isDesktop ? 440 : 20, 40],
            paddingBottomRight: [isDesktop ? 120 : 20, isDesktop ? 40 : 250],
            maxZoom: 15,
            animate: true
        });
    },

    showUserLocation(lat, lng) {
        if (this.userLocationMarker) {
            this.map.removeLayer(this.userLocationMarker);
        }

        const icon = L.divIcon({
            html: `<div class="user-location-pin"></div>`,
            className: '',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });

        this.userLocationMarker = L.marker([lat, lng], { icon, zIndexOffset: 1000 })
            .addTo(this.map)
            .bindPopup('<div class="marker-popup-content"><h4 class="popup-title">📍 Vos estás acá</h4></div>', {
                closeButton: false,
                className: 'custom-leaflet-popup'
            })
            .openPopup();

        this.map.setView([lat, lng], 14, { animate: true });

        if (window.innerWidth > 768) {
            setTimeout(() => this.map.panBy([-CONFIG.SIDEBAR_WIDTH_OFFSET, 0], { animate: true }), 300);
        }
    },

    clearMarkers() {
        if (this.clusterGroup) this.clusterGroup.clearLayers();
        this.markersMap.clear();
    },

    getMarkerIconHtml(category) {
        const COLORS = {
            'Gastronomía': '#D85A30',
            'Cafeterías':  '#EF9F27',
            'Bares':       '#993556',
            'Turismo':     '#0F6E56',
            'Barrios y Compras': '#534AB7',
            'Cultura':     '#7c3aed',
        };
        let symbol = '📍';
        const cat = (category || '').toLowerCase();
        if (cat.includes('bodeg') || cat.includes('gast') || cat.includes('parri') || cat.includes('pizza') || cat.includes('lom') || cat.includes('sandu') || cat.includes('comid')) symbol = '🍽️';
        if (cat.includes('café') || cat.includes('cafe') || cat.includes('cafet') || cat.includes('te')) symbol = '☕';
        if (cat.includes('bar') || cat.includes('sky') || cat.includes('wine') || cat.includes('vino') || cat.includes('magenta')) symbol = '🍷';
        if (cat.includes('turismo') || cat.includes('museo') || cat.includes('sala') || cat.includes('arqu') || cat.includes('natur')) symbol = '🏛️';
        if (cat.includes('compras') || cat.includes('bazar') || cat.includes('barrio')) symbol = '🛍️';
        if (cat.includes('cultura') || cat.includes('arte')) symbol = '🎭';
        if (cat.includes('trekk') || cat.includes('cerro') || cat.includes('patagonia') || cat.includes('montañ')) symbol = '🏔️';
        if (cat.includes('vino') || cat.includes('bodega') || cat.includes('enot')) symbol = '🍇';

        // Find color from category name by fuzzy match
        let color = '#185FA5';
        for (const [key, val] of Object.entries(COLORS)) {
            if (cat.includes(key.toLowerCase().slice(0, 5))) {
                color = val;
                break;
            }
        }

        return `<div class="custom-pin-icon" style="background:${color};border-color:${color};"><div class="custom-pin-inner">${symbol}</div></div>`;
    }
};
