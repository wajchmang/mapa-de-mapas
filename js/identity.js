/**
 * identity.js — Módulo de identidad anónima y persistencia en localStorage
 * No requiere login. Genera un ID anónimo por dispositivo.
 */
const Identity = {
    STORAGE_KEYS: {
        USER_ID: 'mdm_user_id',
        SAVED_MAPS: 'mdm_saved_maps',
        CREATED_MAPS: 'mdm_created_maps'
    },

    /**
     * Retorna el ID de usuario. Lo crea si no existe.
     */
    getUserId() {
        let id = localStorage.getItem(this.STORAGE_KEYS.USER_ID);
        if (!id) {
            // crypto.randomUUID() es nativo en navegadores modernos
            id = typeof crypto !== 'undefined' && crypto.randomUUID
                ? crypto.randomUUID()
                : `mdm-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem(this.STORAGE_KEYS.USER_ID, id);
        }
        return id;
    },

    // ─── Mapas Guardados (Favoritos) ────────────────────────────────────────

    getSavedMapIds() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.SAVED_MAPS)) || [];
        } catch { return []; }
    },

    isMapSaved(mapId) {
        return this.getSavedMapIds().includes(mapId);
    },

    toggleSaveMap(mapId) {
        const saved = this.getSavedMapIds();
        const idx = saved.indexOf(mapId);
        if (idx > -1) {
            saved.splice(idx, 1); // Unsave
        } else {
            saved.push(mapId); // Save
        }
        localStorage.setItem(this.STORAGE_KEYS.SAVED_MAPS, JSON.stringify(saved));
        return this.isMapSaved(mapId);
    },

    getSavedMaps() {
        const ids = this.getSavedMapIds();
        return MAPS_DATABASE.filter(m => ids.includes(m.id));
    },

    // ─── Mapas Creados por el Usuario ───────────────────────────────────────

    getCreatedMaps() {
        try {
            return JSON.parse(localStorage.getItem(this.STORAGE_KEYS.CREATED_MAPS)) || [];
        } catch { return []; }
    },

    saveCreatedMap(mapObj) {
        const maps = this.getCreatedMaps();
        // Add creator info
        mapObj.createdBy = this.getUserId();
        mapObj.createdAt = Date.now();
        maps.unshift(mapObj); // newest first
        localStorage.setItem(this.STORAGE_KEYS.CREATED_MAPS, JSON.stringify(maps));
        // Also add to MAPS_DATABASE so it appears in the catalog
        MAPS_DATABASE.unshift(mapObj);
    },

    deleteCreatedMap(mapId) {
        const maps = this.getCreatedMaps().filter(m => m.id !== mapId);
        localStorage.setItem(this.STORAGE_KEYS.CREATED_MAPS, JSON.stringify(maps));
        const idx = MAPS_DATABASE.findIndex(m => m.id === mapId);
        if (idx > -1) MAPS_DATABASE.splice(idx, 1);
    },

    /**
     * Restores user-created maps into MAPS_DATABASE on app load
     */
    restoreCreatedMaps() {
        const created = this.getCreatedMaps();
        created.forEach(map => {
            if (!MAPS_DATABASE.find(m => m.id === map.id)) {
                MAPS_DATABASE.unshift(map);
            }
        });
    }
};
