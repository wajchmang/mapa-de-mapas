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
        return `<button class="card-save-btn ${isSaved ? 'saved' : ''}" data-map-id="${mapId}" title="${isSaved ? 'Quitar de guardados' : 'Guardar mapa'}">${isSaved ? '❤️' : '🤍'}</button>`;
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

    // ── View 1: Catalog ───────────────────────────────────────────────────
    renderCatalog() {
        const { activeCategory, searchQuery, viewMode } = AppStore.state;
        const container = this.elements.sidebarBody;
        const normQ = AppStore.normalizeText(searchQuery);

        const publishedCount = MAPS_DATABASE.filter(m => m.status === 'published').length;
        const draftCount = MAPS_DATABASE.filter(m => m.status === 'draft').length;
        const modeMaps = MAPS_DATABASE.filter(m => m.status === viewMode);

        let filtered = modeMaps.filter(m => {
            const matchCat = activeCategory === 'Todos' || m.category === activeCategory;
            if (!normQ) return matchCat;
            const hit = (s) => AppStore.normalizeText(s).includes(normQ);
            const tagsHit = (m.tags || []).some(t => hit(t));
            const placesHit = (m.places || []).some(p => hit(p.name) || (p.tags || []).some(t => hit(t)));
            return matchCat && (hit(m.title) || hit(m.description) || tagsHit || placesHit);
        });

        let html = `
            <div class="view-mode-tabs">
                <button class="mode-tab ${viewMode === 'published' ? 'active' : ''}" id="tab-published">Publicados (${publishedCount})</button>
                <button class="mode-tab ${viewMode === 'draft' ? 'active' : ''}" id="tab-draft">Ideas (${draftCount})</button>
            </div>`;

        // Tag cloud only when no active search
        if (!normQ && viewMode === 'published') {
            html += this.buildTagCloud();
        }

        html += `
            <div class="section-header">
                <h2 class="section-title">${viewMode === 'published' ? 'Explorar' : 'En Borrador'}</h2>
                <span class="badge-count">${filtered.length}</span>
            </div>`;

        if (filtered.length === 0) {
            html += `
                <div class="empty-state">
                    <p style="font-size:0.9rem;color:var(--slate-600);margin-bottom:0.75rem;">Sin resultados para <strong>"${searchQuery}"</strong>.</p>
                    ${this.buildTagCloud()}
                    <button class="back-btn" id="reset-search-btn">Ver todos los mapas</button>
                </div>`;
        } else {
            html += `<div class="cards-list">`;
            filtered.forEach(map => {
                const count = (map.places || []).length;
                const isDraft = map.status === 'draft';
                const tagBadges = (map.tags || []).slice(0, 3).map(t => `<span class="tag-badge">#${t}</span>`).join('');
                html += `
                    <div class="item-card ${isDraft ? 'draft-card' : ''}" data-map-id="${map.id}" style="position:relative;">
                        ${this.buildSaveBtn(map.id)}
                        <div class="card-img-wrap">
                            <span class="card-cat-badge">${map.category}</span>
                            <img src="${map.coverImage}" alt="${map.title}" class="card-img" loading="lazy">
                        </div>
                        <div class="card-info">
                            <h3 class="card-title">${map.title}</h3>
                            <div class="card-curator">${map.curator} · <strong>${isDraft ? 'Borrador' : count + ' lugares'}</strong></div>
                            <p class="card-desc">${map.description}</p>
                            <div class="tags-container">${tagBadges}</div>
                        </div>
                    </div>`;
            });
            html += `</div>`;
        }

        container.innerHTML = html;

        document.getElementById('tab-published')?.addEventListener('click', () => AppStore.setViewMode('published'));
        document.getElementById('tab-draft')?.addEventListener('click', () => AppStore.setViewMode('draft'));
        document.getElementById('reset-search-btn')?.addEventListener('click', () => AppStore.setSearchQuery(''));
        container.querySelectorAll('.item-card').forEach(card => {
            card.addEventListener('click', () => AppStore.setActiveMap(card.dataset.mapId));
        });
        this.bindSaveBtns(container);
        this.bindTagCloud(container);
    },

    // ── View 2: Map detail ────────────────────────────────────────────────
    renderMapDetail(map) {
        const container = this.elements.sidebarBody;
        const { searchQuery, selectedPlaceId } = AppStore.state;
        const normQ = AppStore.normalizeText(searchQuery);
        const catColor = getCatColor(map.category);

        let places = map.places || [];
        if (normQ) {
            places = places.filter(p =>
                AppStore.normalizeText(p.name).includes(normQ) ||
                AppStore.normalizeText(p.description || '').includes(normQ) ||
                (p.tags || []).some(t => AppStore.normalizeText(t).includes(normQ))
            );
        }

        const tagBadges = (map.tags || []).map(t => `<span class="tag-badge">#${t}</span>`).join('');

        let html = `
            <div class="section-header">
                <button class="back-btn" id="btn-back-catalog">← Todos los mapas</button>
                <span class="badge-count">${places.length} lugares</span>
            </div>
            <div style="margin-bottom:1.25rem;">
                <h2 style="font-size:1.2rem;font-weight:800;color:var(--navy-900);">${map.title}</h2>
                <div style="font-size:0.8rem;color:var(--slate-600);margin-top:0.2rem;">Curado por <strong>${map.curator}</strong></div>
                <p style="font-size:0.82rem;color:var(--slate-600);margin-top:0.4rem;">${map.description}</p>
                <div class="tags-container" style="margin-top:0.4rem;">${tagBadges}</div>
            </div>
            <div class="cards-list">`;

        places.forEach(place => {
            const isActive = place.id === selectedPlaceId;
            const placeCatColor = getCatColor(place.category || map.category);
            const placeTags = (place.tags || []).slice(0, 2).map(t => `<span class="tag-badge">#${t}</span>`).join('');
            html += `
                <div class="item-card place-item ${isActive ? 'active' : ''}"
                     data-place-id="${place.id}" id="card-place-${place.id}">
                    <div class="card-img-wrap">
                        <span class="card-cat-badge">${place.category}</span>
                        <img src="${place.photo}" alt="${place.name}" class="card-img" loading="lazy"
                             onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800'">
                    </div>
                    <div class="card-info" style="background:${placeCatColor};">
                        <h3 class="card-title">${place.name}</h3>
                        <div class="card-curator">📍 ${place.address}</div>
                        <p class="card-desc">${(place.description || '').slice(0, 80)}${(place.description || '').length > 80 ? '…' : ''}</p>
                        <div class="tags-container">${placeTags}</div>
                    </div>
                </div>`;
        });

        html += `</div>`;
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
        const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
        const tagBadges = (place.tags || []).map(t => `<span class="tag-badge">#${t}</span>`).join('');

        container.innerHTML = `
            <div class="section-header">
                <button class="back-btn" id="btn-back-map">← ${activeMap ? activeMap.title : 'Mapa'}</button>
            </div>
            <div class="place-detail-view">
                <div class="detail-banner">
                    <img src="${place.photo}" alt="${place.name}"
                         onerror="this.onerror=null;this.src='https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800'">
                </div>
                <div>
                    <h2 class="detail-name">${place.name}</h2>
                    <div class="detail-address">📍 ${place.address}</div>
                    <div class="tags-container" style="margin-top:0.4rem;">${tagBadges}</div>
                </div>
                <p class="detail-desc">${place.description || ''}</p>
                <a href="${mapsUrl}" target="_blank" rel="noopener" class="action-btn-directions">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
                    Cómo llegar
                </a>
            </div>`;

        document.getElementById('btn-back-map').addEventListener('click', () => AppStore.setSelectedPlace(null));
    }
};
