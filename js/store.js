/**
 * Application State Store & Accent-Insensitive Search Router (v4)
 */
const AppStore = {
    state: {
        activeMapId: null,      // e.g. "bodegones"
        selectedPlaceId: null,  // e.g. "bg-1"
        activeCategory: 'Todos',
        searchQuery: '',
        viewMode: 'published',  // 'published' | 'draft'
        listeners: []
    },

    init() {
        this.parseUrlHash();
        window.addEventListener('hashchange', () => {
            this.parseUrlHash();
        });
    },

    subscribe(listener) {
        this.state.listeners.push(listener);
    },

    notify() {
        this.state.listeners.forEach(fn => fn(this.state));
    },

    /**
     * Remove accents/tildes and normalize for search
     */
    normalizeText(str) {
        if (!str) return '';
        return str
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .trim();
    },

    setActiveMap(mapId) {
        this.state.activeMapId = mapId;
        this.state.selectedPlaceId = null;
        this.updateUrlHash();
        this.notify();
    },

    setSelectedPlace(placeId) {
        this.state.selectedPlaceId = placeId;
        this.updateUrlHash();
        this.notify();
    },

    setCategory(category) {
        this.state.activeCategory = category;
        this.notify();
    },

    setViewMode(mode) {
        this.state.viewMode = mode;
        this.state.activeMapId = null;
        this.state.selectedPlaceId = null;
        this.notify();
    },

    setSearchQuery(query) {
        this.state.searchQuery = query;
        this.notify();
    },

    resetToCatalog() {
        this.state.activeMapId = null;
        this.state.selectedPlaceId = null;
        this.state.searchQuery = '';
        this.state.activeCategory = 'Todos';
        this.updateUrlHash();
        this.notify();
    },

    parseUrlHash() {
        const hash = window.location.hash.replace('#', '');
        const params = new URLSearchParams(hash);

        const mapId = params.get('map');
        const placeId = params.get('place');

        if (mapId) {
            this.state.activeMapId = mapId;
        }
        if (placeId) {
            this.state.selectedPlaceId = placeId;
        }

        this.notify();
    },

    updateUrlHash() {
        const params = new URLSearchParams();
        if (this.state.activeMapId) {
            params.set('map', this.state.activeMapId);
        }
        if (this.state.selectedPlaceId) {
            params.set('place', this.state.selectedPlaceId);
        }

        const newHash = params.toString();
        if (newHash) {
            history.replaceState(null, '', `${window.location.pathname}${window.location.search}#${newHash}`);
        } else {
            history.replaceState(null, '', window.location.pathname + window.location.search);
        }
    },

    getActiveMap() {
        if (!this.state.activeMapId) return null;
        return MAPS_DATABASE.find(m => m.id === this.state.activeMapId);
    },

    getSelectedPlace() {
        const activeMap = this.getActiveMap();
        if (!activeMap || !this.state.selectedPlaceId) return null;
        return activeMap.places.find(p => p.id === this.state.selectedPlaceId);
    }
};
