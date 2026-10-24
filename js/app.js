/**
 * app.js v5 — Application Orchestrator
 * Binds Store, UI, Map Engine, Right Panel and Identity
 */
const App = {
    init() {
        // Restore any previously created maps into the database
        Identity.restoreCreatedMaps();

        // Init UI and Map
        UI.init();
        MapEngine.init('map-viewport');

        // Subscribe to store changes
        AppStore.subscribe(() => this.onStateChange());

        // Init Right Panel
        RightPanel.init();

        // Initial render
        this.onStateChange();

        // Hash routing support
        this.handleInitialHash();
        window.addEventListener('hashchange', () => this.handleInitialHash());
    },

    handleInitialHash() {
        const hash = window.location.hash;
        if (!hash) return;
        const params = new URLSearchParams(hash.slice(1));
        const mapId = params.get('map');
        const placeId = params.get('place');
        if (mapId) {
            AppStore.state.activeMapId = mapId;
            if (placeId) AppStore.state.selectedPlaceId = placeId;
            this.onStateChange();
        }
    },

    onStateChange() {
        const activeMap = AppStore.getActiveMap();
        const selectedPlace = AppStore.getSelectedPlace();

        // Update URL hash
        if (activeMap) {
            const params = new URLSearchParams({ map: activeMap.id });
            if (selectedPlace) params.set('place', selectedPlace.id);
            window.history.replaceState(null, '', `#${params.toString()}`);
        } else {
            window.history.replaceState(null, '', window.location.pathname);
        }

        // Render sidebar
        UI.render();

        // Render map markers
        if (activeMap && selectedPlace) {
            MapEngine.panToPlace(selectedPlace);
        } else if (activeMap && (activeMap.places || []).length > 0) {
            MapEngine.renderPlaces(activeMap.places, (place) => AppStore.setSelectedPlace(place.id));
        } else if (!activeMap) {
            MapEngine.clearMarkers();
            if (MapEngine.map) MapEngine.map.setView(CONFIG.DEFAULT_CENTER, CONFIG.DEFAULT_ZOOM, { animate: true });
        }

        // Update category filters
        document.querySelectorAll('.chip-btn').forEach(btn => {
            btn.classList.toggle('active', btn.textContent === AppStore.state.activeCategory);
        });
    }
};

document.addEventListener('DOMContentLoaded', () => App.init());
