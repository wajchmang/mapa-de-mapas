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

        // Links directos (#map=...&place=...): leerlos ANTES del primer dibujo,
        // porque el primer dibujo reescribe la dirección y borraría el link.
        this.readHashIntoState();

        // Initial render
        this.onStateChange();

        // Si alguien cambia el link a mano con la página abierta
        window.addEventListener('hashchange', () => this.handleInitialHash());
    },

    /** Copia el mapa y el lugar del link al estado, sin dibujar. Devuelve true si había un mapa. */
    readHashIntoState() {
        const hash = window.location.hash;
        if (!hash) return false;
        const params = new URLSearchParams(hash.slice(1));
        const mapId = params.get('map');
        const placeId = params.get('place');
        if (!mapId) return false;
        AppStore.state.activeMapId = mapId;
        AppStore.state.selectedPlaceId = placeId || null;
        // Link a un mapa que no existe (o fue borrado): ignorarlo y mostrar el inicio
        if (!AppStore.getActiveMap()) {
            AppStore.state.activeMapId = null;
            AppStore.state.selectedPlaceId = null;
            return false;
        }
        if (placeId && !AppStore.getSelectedPlace()) AppStore.state.selectedPlaceId = null;
        return true;
    },

    handleInitialHash() {
        if (this.readHashIntoState()) this.onStateChange();
    },

    onStateChange() {
        const activeMap = AppStore.getActiveMap();
        const selectedPlace = AppStore.getSelectedPlace();

        // Update URL hash
        if (activeMap) {
            const params = new URLSearchParams({ map: activeMap.id });
            if (selectedPlace) params.set('place', selectedPlace.id);
            window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${params.toString()}`);
        } else {
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }

        // Render sidebar
        UI.render();

        // Render map markers
        if (activeMap && selectedPlace) {
            // Si se entró directo a un lugar (link), primero dibujar los pines de su mapa
            if (MapEngine.renderedPlaces !== activeMap.places) {
                MapEngine.renderPlaces(activeMap.places, (place) => AppStore.setSelectedPlace(place.id));
            }
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
