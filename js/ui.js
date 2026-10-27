/**
 * ui.js v6 — Tag cloud, color-coded place cards, category chips, save button
 */

// Helper: devuelve el color CSS de una categoría
const CATEGORY_COLORS = {
    'Gastronomía': '#D85A30',
    'Cafeterías':  '#EF9F27',
    'Bares':       '#993556',
    'Turismo':     '#0F6E56',
    'Barrios y Compras': '#534AB7',
    'Cultura':     '#7c3aed',
};
function getCatColor(cat) {
    for (const [key, val] of Object.entries(CATEGORY_COLORS)) {
        if ((cat || '').toLowerCase().includes(key.toLowerCase().slice(0,5))) return val;
    }
    return '#185FA5';
}

// Ícono por categoría (portadas de diseño cuando no hay foto)
const CATEGORY_ICONS = {
    'Gastronomía': '🍽️',
    'Cafeterías':  '☕',
    'Bares':       '🍸',
    'Turismo':     '🧭',
    'Barrios y Compras': '🛍️',
    'Cultura':     '🎭',
};
function getCatIcon(cat) {
    for (const [key, val] of Object.entries(CATEGORY_ICONS)) {
        if ((cat || '').toLowerCase().includes(key.toLowerCase().slice(0,5))) return val;
    }
    return '📍';
}

// Todo texto que viene de la base (lo carga la comunidad) se escapa antes de mostrarlo
const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

// Tags destacados para la nube
const FEATURED_TAGS = [
    'terraza', 'sol', 'gratis', 'económico', 'invierno', 'asado',
    'brunch', 'vino', 'bodegas', 'nocturno', 'bodegon', 'pizza',
    'turismo', 'patagonia', 'arquitectura', 'mendoza', 'bariloche'
];

const UI = {
    elements: {},

    init() {
        this.elements = {
            sidebarBody: document.getElementById('sidebar-body'),
            categoriesScroll: document.getElementById('category-scroll'),
            searchInput: document.getElementById('search-input'),
            brandTitle: document.querySelector('.brand-title'),
            fileInput: document.getElementById('kml-file-input'),
        };

        this.setupBrandHomeLink();
        this.setupCategories();
        this.setupSearch();
    },

    setupBrandHomeLink() {
        if (this.elements.brandTitle) {
            this.elements.brandTitle.style.cursor = 'pointer';
            this.elements.brandTitle.title = 'Volver al inicio';
            this.elements.brandTitle.addEventListener('click', () => AppStore.resetToCatalog());
        }
    },

    setupCategories() {
        const categories = ['Todos', 'Gastronomía', 'Cafeterías', 'Bares', 'Turismo', 'Barrios y Compras', 'Cultura'];
        this.elements.categoriesScroll.innerHTML = '';
        categories.forEach(cat => {
            const btn = document.createElement('button');
            btn.className = `chip-btn ${cat === AppStore.state.activeCategory ? 'active' : ''}`;
            btn.textContent = cat;
            btn.dataset.cat = cat;
            if (cat !== 'Todos') {
                const color = getCatColor(cat);
                if (cat === AppStore.state.activeCategory) {
                    btn.style.background = color;
                    btn.style.borderColor = color;
                    btn.style.color = 'white';
                }
            }
            btn.addEventListener('click', () => AppStore.setCategory(cat));
            this.elements.categoriesScroll.appendChild(btn);
        });
    },

    setupSearch() {
        this.elements.searchInput.addEventListener('input', (e) => {
            AppStore.setSearchQuery(e.target.value);
        });
    },

    // ── Save button helper ───────────────────────────────────────────────
    buildSaveBtn(mapId) {
        const isSaved = Identity.isMapSaved(mapId);
        return `<button class="card-save-btn ${isSaved ? 'saved' : ''}" data-map-id="${esc(mapId)}" title="${isSaved ? 'Quitar de guardados' : 'Guardar mapa'}">${isSaved ? '❤️' : '🤍'}</button>`;
    },

    bindSaveBtns(container) {
        container.querySelectorAll('.card-save-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const mapId = btn.dataset.mapId;
                const nowSaved = Identity.toggleSaveMap(mapId);
                btn.textContent = nowSaved ? '❤️' : '🤍';
                btn.classList.toggle('saved', nowSaved);
                btn.title = nowSaved ? 'Quitar de guardados' : 'Guardar mapa';
            });
        });
    },

    // ── Tag cloud ────────────────────────────────────────────────────────
    buildTagCloud() {
        const pills = FEATURED_TAGS.map(t =>
            `<button class="tag-pill" data-tag="${t}">#${t}</button>`
        ).join('');
        return `
            <div class="tag-cloud-section">
                <div class="tag-cloud-label">Buscá por concepto</div>
                <div class="tag-cloud">${pills}</div>
            </div>`;
    },

    bindTagCloud(container) {
        container.querySelectorAll('.tag-pill').forEach(pill => {
            pill.addEventListener('click', () => {
                const tag = pill.dataset.tag;
                this.elements.searchInput.value = tag;
                AppStore.setSearchQuery(tag);
            });
        });
    },

    render() {
        const activeMap = AppStore.getActiveMap();
        const selectedPlace = AppStore.getSelectedPlace();
        if (selectedPlace) this.renderPlaceDetail(selectedPlace, activeMap);
        else if (activeMap) this.renderMapDetail(activeMap);
        else this.renderCatalog();

        // Sync category chip colors
        document.querySelectorAll('.chip-btn').forEach(btn => {
            const isActive = btn.textContent === AppStore.state.activeCategory;
            btn.classList.toggle('active', isActive);
            if (isActive && btn.dataset.cat !== 'Todos') {
                const color = getCatColor(btn.dataset.cat);
                btn.style.background = color;
                btn.style.borderColor = color;
                btn.style.color = 'white';
            } else {
                btn.style.background = '';
                btn.style.borderColor = '';
                btn.style.color = '';
            }
        });
    },

    // ── Helpers de presentación ───────────────────────────────────────────
    /** Portada: foto si hay; si no (o si falla), color de la categoría + ícono */
    coverHtml(imageUrl, category, extraClass = '') {
        const color = getCatColor(category);
        const icon = getCatIcon(category);
        const img = imageUrl
            ? `<img src="${esc(imageUrl)}" alt="" class="card-img" loading="lazy" referrerpolicy="no-referrer"
                   onerror="this.onerror=null;this.parentNode.classList.add('no-img');this.remove();">`
            : '';
        return `<div class="card-img-wrap ${imageUrl ? '' : 'no-img'} ${extraClass}" style="--cat:${color}" data-icon="${icon}">
                    <span class="card-cat-badge">${esc(category || '')}</span>${img}
                </div>`;
    },

    /** "Creado por X · Sumado por Y" */
    creditsHtml(map) {
        const parts = [`Creado por <strong>${esc(map.curator)}</strong>`];
        if (map.addedBy && map.addedBy !== map.curator) parts.push(`sumado por ${esc(map.addedBy)}`);
        return parts.join(' · ');
    },

    openExternal(url) {
        if (!url) return;
        window.open(url, '_blank', 'noopener');
    },

    // ── View 1: Catalog ───────────────────────────────────────────────────
    renderCatalog() {
        const { activeCategory, searchQuery, viewMode } = AppStore.state;
        const container = this.elements.sidebarBody;
        const normQ = AppStore.normalizeText(searchQuery);

        if (typeof DataSource !== 'undefined' && DataSource.loading) {
            container.innerHTML = `
                <div class="loading-state">
                    <div class="loading-dot"></div>
                    <p>Cargando mapas…</p>
                </div>`;
            return;
        }

        const publishedCount = MAPS_DATABASE.filter(m => m.status === 'published').length;
        const draftCount = MAPS_DATABASE.filter(m => m.status === 'draft').length;
        const mode = draftCount === 0 ? 'published' : viewMode;
        const modeMaps = MAPS_DATABASE.filter(m => m.status === mode);

        const filtered = modeMaps.filter(m => {
            const matchCat = activeCategory === 'Todos' || m.category === activeCategory;
            if (!normQ) return matchCat;
            const hit = (s) => AppStore.normalizeText(s).includes(normQ);
            const tagsHit = (m.tags || []).some(t => hit(t));
            const placesHit = (m.places || []).some(p => hit(p.name) || hit(p.category) || (p.tags || []).some(t => hit(t)));
            return matchCat && (hit(m.title) || hit(m.description) || hit(m.curator) || tagsHit || placesHit);
        });

        let html = '';
        if (draftCount > 0) {
            html += `
            <div class="view-mode-tabs">
                <button class="mode-tab ${mode === 'published' ? 'active' : ''}" id="tab-published">Publicados (${publishedCount})</button>
                <button class="mode-tab ${mode === 'draft' ? 'active' : ''}" id="tab-draft">Ideas (${draftCount})</button>
            </div>`;
        }

        if (!normQ && mode === 'published') html += this.buildTagCloud();

        html += `
            <div class="section-header">
                <h2 class="section-title">${mode === 'published' ? 'Explorar' : 'En Borrador'}</h2>
                <span class="badge-count">${filtered.length}</span>
            </div>`;

        if (filtered.length === 0) {
            html += `
                <div class="empty-state">
                    <p style="font-size:0.9rem;color:var(--slate-600);margin-bottom:0.75rem;">Sin resultados para <strong>"${esc(searchQuery)}"</strong>.</p>
                    ${this.buildTagCloud()}
                    <button class="back-btn" id="reset-search-btn">Ver todos los mapas</button>
                </div>`;
        } else {
            html += `<div class="cards-list">`;
            filtered.forEach(map => {
                const isDraft = map.status === 'draft';
                const isList = map.source === 'google_list';
                const count = (map.places || []).length;
                const tagBadges = (map.tags || []).slice(0, 3).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');
                const meta = isDraft ? 'Borrador' : isList ? 'Lista de Google Maps ↗' : `${count} lugares`;
                html += `
                    <div class="item-card ${isDraft ? 'draft-card' : ''} ${isList ? 'list-card' : ''}" data-map-id="${esc(map.id)}" style="position:relative;">
                        ${this.buildSaveBtn(map.id)}
                        ${this.coverHtml(map.coverImage, map.category)}
                        <div class="card-info">
                            <h3 class="card-title">${esc(map.title)}</h3>
                            <div class="card-curator">${esc(map.curator)} · <strong>${meta}</strong></div>
                            <p class="card-desc">${esc(map.description)}</p>
                            <div class="tags-container">${tagBadges}</div>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        container.innerHTML = html;

        document.getElementById('tab-published')?.addEventListener('click', () => AppStore.setViewMode('published'));
        document.getElementById('tab-draft')?.addEventListener('click', () => AppStore.setViewMode('draft'));
        document.getElementById('reset-search-btn')?.addEventListener('click', () => {
            this.elements.searchInput.value = '';
            AppStore.setSearchQuery('');
        });
        container.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', () => {
                const map = MAPS_DATABASE.find(m => m.id === card.dataset.mapId);
                if (map && map.source === 'google_list') this.openExternal(map.sourceUrl);
                else AppStore.setActiveMap(card.dataset.mapId);
            });
        });
        this.bindSaveBtns(container);
        this.bindTagCloud(container);
    },

    // ── View 2: Map detail ────────────────────────────────────────────────
    renderMapDetail(map) {
        const container = this.elements.sidebarBody;
        const { searchQuery, selectedPlaceId } = AppStore.state;
        const normQ = AppStore.normalizeText(searchQuery);
        const isList = map.source === 'google_list';

        let places = map.places || [];
        if (normQ) {
            places = places.filter(p =>
                AppStore.normalizeText(p.name).includes(normQ) ||
                AppStore.normalizeText(p.description || '').includes(normQ) ||
                AppStore.normalizeText(p.category || '').includes(normQ) ||
                (p.tags || []).some(t => AppStore.normalizeText(t).includes(normQ))
            );
        }

        const tagBadges = (map.tags || []).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');
        const originalLink = map.sourceUrl
            ? `<a href="${esc(map.sourceUrl)}" target="_blank" rel="noopener" class="source-link">${isList ? 'Abrir la lista en Google Maps ↗' : 'Ver el mapa original en Google ↗'}</a>`
            : '';

        let html = `
            <div class="section-header">
                <button class="back-btn" id="btn-back-catalog">← Todos los mapas</button>
                ${isList ? '' : `<span class="badge-count">${places.length} lugares</span>`}
            </div>
            <div class="map-detail-head">
                <h2 class="map-detail-title">${esc(map.title)}</h2>
                <div class="map-detail-credits">${this.creditsHtml(map)}</div>
                ${map.description ? `<p class="map-detail-desc">${esc(map.description)}</p>` : ''}
                <div class="tags-container" style="margin-top:0.4rem;">${tagBadges}</div>
                ${originalLink}
            </div>`;

        if (isList) {
            html += `<p class="list-note">Esta es una lista de Google Maps: sus lugares se ven en Google Maps.</p>`;
        } else {
            html += `<div class="cards-list">`;
            places.forEach(place => {
                const isActive = place.id === selectedPlaceId;
                const placeCat = place.category || map.category;
                const placeCatColor = getCatColor(map.category);
                const desc = place.description || '';
                const placeTags = (place.tags || []).slice(0, 2).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');
                html += `
                    <div class="item-card place-item ${isActive ? 'active' : ''}"
                         data-place-id="${esc(place.id)}" id="card-place-${esc(place.id)}">
                        ${this.coverHtml(place.photo, placeCat, 'place-cover')}
                        <div class="card-info" style="background:${placeCatColor};">
                            <h3 class="card-title">${esc(place.name)}</h3>
                            ${place.address ? `<div class="card-curator">📍 ${esc(place.address)}</div>` : ''}
                            ${desc ? `<p class="card-desc">${esc(desc.slice(0, 90))}${desc.length > 90 ? '…' : ''}</p>` : ''}
                            <div class="tags-container">${placeTags}</div>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        container.innerHTML = html;

        if (selectedPlaceId) {
            setTimeout(() => {
                document.getElementById(`card-place-${selectedPlaceId}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 100);
        }

        document.getElementById('btn-back-catalog').addEventListener('click', () => AppStore.setActiveMap(null));
        container.querySelectorAll('.place-item').forEach(card => {
            card.addEventListener('click', () => AppStore.setSelectedPlace(card.dataset.placeId));
        });
    },

    // ── View 3: Place Detail ──────────────────────────────────────────────
    renderPlaceDetail(place, activeMap) {
        const container = this.elements.sidebarBody;
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.lat + ',' + place.lng)}`;
        const tagBadges = (place.tags || []).map(t => `<span class="tag-badge">#${esc(t)}</span>`).join('');
        const cat = place.category || (activeMap && activeMap.category) || '';

        container.innerHTML = `
            <div class="section-header">
                <button class="back-btn" id="btn-back-map">← ${esc(activeMap ? activeMap.title : 'Mapa')}</button>
            </div>
            <div class="place-detail-view">
                ${place.photo
                    ? `<div class="detail-banner"><img src="${esc(place.photo)}" alt="" referrerpolicy="no-referrer"
                           onerror="this.onerror=null;this.parentNode.remove();"></div>`
                    : ''}
                <div>
                    ${cat ? `<span class="detail-cat" style="--cat:${getCatColor(activeMap ? activeMap.category : cat)}">${esc(cat)}</span>` : ''}
                    <h2 class="detail-name">${esc(place.name)}</h2>
                    ${place.address ? `<div class="detail-address">📍 ${esc(place.address)}</div>` : ''}
                    <div class="tags-container" style="margin-top:0.4rem;">${tagBadges}</div>
                </div>
                ${place.description ? `<p class="detail-desc">${esc(place.description)}</p>` : ''}
                <a href="${mapsUrl}" target="_blank" rel="noopener" class="action-btn-directions">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Cómo llegar
                </a>
                ${activeMap ? `<p class="detail-credit">De “${esc(activeMap.title)}” · ${this.creditsHtml(activeMap)}</p>` : ''}
            </div>`;

        document.getElementById('btn-back-map').addEventListener('click', () => AppStore.setSelectedPlace(null));
    }
};
