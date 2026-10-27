/**
 * data-source.js — Trae los mapas desde la base de datos (Supabase)
 *
 * Reemplaza el contenido de MAPS_DATABASE (que arranca con el archivo local
 * data/maps-data.js) por los mapas de la base. Si la base no responde, el
 * sitio sigue funcionando con el archivo local como respaldo.
 *
 * Formato de cada mapa (el mismo que ya usaba el sitio):
 *   { id, status, title, category, curator, addedBy, description, coverImage,
 *     tags, source, sourceUrl, savesCount, placeCount, places: [...] }
 *   source: 'google_mymaps' | 'google_list' | 'curated'
 *   Las listas de Google Maps ('google_list') no traen lugares: se abren en Google Maps.
 */

// Se guarda el link con el que se entró ANTES de que la app reescriba la dirección
const INITIAL_HASH = window.location.hash;

const DataSource = {
    loading: false,
    origin: 'local',      // 'local' | 'remote'
    PAGE: 1000,           // máximo de filas por pedido a la base
    TIMEOUT_MS: 12000,

    async load() {
        if (typeof Auth === 'undefined' || !Auth.client) return false;
        this.loading = true;
        UI.render();

        try {
            const result = await Promise.race([
                this.fetchAll(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), this.TIMEOUT_MS))
            ]);
            this.apply(result.maps, result.places);
            this.origin = 'remote';
            return true;
        } catch (err) {
            console.warn('No se pudieron traer los mapas de la base; uso el archivo local.', err);
            return false;
        } finally {
            this.loading = false;
            this.afterLoad();
        }
    },

    async fetchAll() {
        const db = Auth.client;

        const { data: maps, error: mapsErr } = await db
            .from('maps')
            .select('id, slug, title, description, category, tags, cover_image, source, source_url, author_name, status, saves_count, place_count, created_at, added_by_profile:profiles!maps_added_by_fkey(display_name)')
            .in('status', ['published', 'draft'])
            .order('saves_count', { ascending: false })
            .order('created_at', { ascending: true });
        if (mapsErr) throw mapsErr;

        // Los lugares se traen en tandas (la base entrega hasta 1000 por pedido)
        const places = [];
        for (let from = 0; ; from += this.PAGE) {
            const { data, error } = await db
                .from('places')
                .select('map_id, key, name, category, address, lat, lng, description, photo, tags, position')
                .order('map_id', { ascending: true })
                .order('position', { ascending: true })
                .range(from, from + this.PAGE - 1);
            if (error) throw error;
            places.push(...data);
            if (data.length < this.PAGE) break;
        }
        return { maps, places };
    },

    apply(maps, places) {
        const byMap = new Map();
        places.forEach(p => {
            if (!byMap.has(p.map_id)) byMap.set(p.map_id, []);
            byMap.get(p.map_id).push({
                id: p.key,
                name: p.name,
                category: p.category,
                address: p.address,
                lat: p.lat,
                lng: p.lng,
                description: p.description,
                photo: p.photo,
                tags: p.tags || [],
                mapCategory: null   // se completa abajo con la categoría del mapa (color del pin)
            });
        });

        const converted = maps.map(m => ({
            id: m.slug,
            dbId: m.id,
            status: m.status,
            title: m.title,
            category: m.category,
            curator: m.author_name || 'Autor desconocido',
            addedBy: m.added_by_profile ? m.added_by_profile.display_name : null,
            description: m.description || '',
            coverImage: m.cover_image,
            tags: m.tags || [],
            source: m.source,
            sourceUrl: m.source_url,
            savesCount: m.saves_count || 0,
            placeCount: m.place_count || 0,
            places: (byMap.get(m.id) || []).map(p => Object.assign(p, { mapCategory: m.category }))
        }));

        // Reemplazar el contenido sin cambiar la referencia (otros módulos la usan)
        MAPS_DATABASE.length = 0;
        MAPS_DATABASE.push(...converted);

        // Mapas creados en este navegador con la herramienta vieja (si hay)
        if (typeof Identity !== 'undefined' && Identity.restoreCreatedMaps) Identity.restoreCreatedMaps();
    },

    afterLoad() {
        // Si se entró con un link a un mapa que recién ahora existe, abrirlo
        if (INITIAL_HASH && INITIAL_HASH.length > 1 && !AppStore.state.activeMapId) {
            history.replaceState(null, '', window.location.pathname + window.location.search + INITIAL_HASH);
            if (typeof App !== 'undefined') App.handleInitialHash();
        }
        if (typeof App !== 'undefined') App.onStateChange();
    },

    isList(map) {
        return !!map && map.source === 'google_list';
    }
};

// Si hay conexión a la base, el primer dibujo muestra "Cargando mapas…" en vez del archivo local
DataSource.loading = typeof Auth !== 'undefined' && !!Auth.client;

document.addEventListener('DOMContentLoaded', () => {
    // Después de que App arrancó con los datos locales
    setTimeout(() => DataSource.load(), 0);
});
