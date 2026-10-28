/**
 * right-panel.js — Orquestador del panel derecho flotante (v5)
 * Maneja los modos: idle | geo | myMaps | createMap
 */
const RightPanel = {
    mode: null, // null | 'geo' | 'myMaps' | 'createMap'
    userLat: null,
    userLng: null,
    geoRadius: 1000, // metros por defecto
    searchDebounceTimer: null,
    pendingPlaces: [], // Lugares agregados al nuevo mapa en formación

    init() {
        this.container = document.getElementById('right-expanded-panel');
        this.btnGeo = document.getElementById('btn-geo');
        this.btnMyMaps = document.getElementById('btn-my-maps');
        this.btnCreate = document.getElementById('btn-create-map');
        this.btnAccount = document.getElementById('btn-account');

        if (this.btnAccount) {
            this.btnAccount.addEventListener('click', () => this.toggleMode('account'));
            if (typeof Auth !== 'undefined') {
                Auth.subscribe(() => {
                    this.updateAccountButton();
                    if (this.mode === 'account') this.renderAccount();
                    if (this.mode === 'indexMap' && !this.indexData) this.renderIndexMap();
                });
            }
            this.updateAccountButton();
        }

        this.btnGeo.addEventListener('click', () => this.toggleMode('geo'));
        this.btnMyMaps.addEventListener('click', () => this.toggleMode('myMaps'));
        this.btnCreate.addEventListener('click', () => this.toggleMode('indexMap'));
    },

    toggleMode(newMode) {
        if (this.mode === newMode) {
            this.close();
            return;
        }
        this.mode = newMode;

        // Update button active states
        this.allButtons().forEach(b => b.classList.remove('active'));
        const activeBtn = { account: this.btnAccount, geo: this.btnGeo, myMaps: this.btnMyMaps, createMap: this.btnCreate, indexMap: this.btnCreate }[newMode];
        if (activeBtn) activeBtn.classList.add('active');

        this.renderMode();
        this.container.classList.add('open');
    },

    close() {
        this.mode = null;
        this.container.classList.remove('open');
        this.allButtons().forEach(b => b.classList.remove('active'));
    },

    allButtons() {
        return [this.btnAccount, this.btnGeo, this.btnMyMaps, this.btnCreate].filter(Boolean);
    },

    renderMode() {
        switch (this.mode) {
            case 'account': this.renderAccount(); break;
            case 'geo': this.renderGeo(); break;
            case 'myMaps': this.renderMyMaps(); break;
            case 'createMap': this.renderCreateMap(); break;
            case 'indexMap': this.renderIndexMap(); break;
        }
    },

    // ────────────────────────────────────────────────────────────────────
    // GEO MODE
    // ────────────────────────────────────────────────────────────────────
    renderGeo() {
        this.container.innerHTML = `
            <div class="expanded-panel-header">
                <span class="expanded-panel-title">📍 Cerca tuyo</span>
                <button class="panel-close-btn" id="rp-close">✕</button>
            </div>
            <div class="expanded-panel-body" id="geo-body">
                <div class="geo-state" id="geo-initial-state">
                    <div class="geo-state-icon">🗺️</div>
                    <div class="geo-state-title">Encontrá lugares cerca tuyo</div>
                    <p class="geo-state-desc">Te vamos a pedir acceso a tu ubicación para mostrarte los lugares más cercanos.</p>
                    <button id="btn-request-geo" style="margin-top: 1.25rem; background: var(--primary); color: white; border: none; border-radius: 9999px; padding: 0.7rem 1.5rem; font-weight: 700; font-size: 0.9rem; font-family: inherit; cursor: pointer; width: 100%;">
                        Permitir ubicación
                    </button>
                </div>
            </div>
        `;
        document.getElementById('rp-close').addEventListener('click', () => this.close());
        document.getElementById('btn-request-geo').addEventListener('click', () => this.requestGeo());
    },

    requestGeo() {
        const body = document.getElementById('geo-body');
        body.innerHTML = `<div class="geo-state"><div class="geo-state-icon">⏳</div><div class="geo-state-title">Buscando tu ubicación...</div></div>`;

        if (!navigator.geolocation) {
            this.renderGeoError('Tu navegador no soporta geolocalización.');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                this.userLat = position.coords.latitude;
                this.userLng = position.coords.longitude;
                this.showNearbyResults();
            },
            (error) => {
                let msg = 'No pudimos acceder a tu ubicación.';
                if (error.code === error.PERMISSION_DENIED) {
                    msg = 'Denegaste el acceso a la ubicación. Podés buscar por barrio usando el buscador (ej: "Palermo", "Boedo").';
                }
                this.renderGeoError(msg);
            },
            { timeout: 10000, enableHighAccuracy: true }
        );
    },

    renderGeoError(msg) {
        const body = document.getElementById('geo-body');
        body.innerHTML = `
            <div class="geo-state">
                <div class="geo-state-icon">⚠️</div>
                <div class="geo-state-title">No pudimos localizarte</div>
                <p class="geo-state-desc">${msg}</p>
            </div>
        `;
    },

    showNearbyResults() {
        // Place user marker on map
        MapEngine.showUserLocation(this.userLat, this.userLng);

        const body = document.getElementById('geo-body');
        const nearbyPlaces = this.getPlacesWithinRadius(this.geoRadius);
        const radiusLabel = this.geoRadius >= 1000
            ? `${(this.geoRadius / 1000).toFixed(1)} km`
            : `${this.geoRadius} m`;

        let html = `
            <div class="geo-slider-wrap">
                <div class="geo-slider-label">Radio de búsqueda <span id="radius-display">${radiusLabel}</span></div>
                <input type="range" class="geo-slider" id="geo-radius-slider"
                       min="200" max="20000" step="100" value="${this.geoRadius}">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;color:var(--slate-400);margin-top:0.15rem;">
                    <span>200 m</span><span>20 km</span>
                </div>
            </div>`;

        if (nearbyPlaces.length === 0) {
            html += `
                <div class="geo-state">
                    <div class="geo-state-icon">🔍</div>
                    <div class="geo-state-title">Nada en este radio</div>
                    <p class="geo-state-desc">No hay lugares guardados en ${radiusLabel}. Ampliá el slider.</p>
                </div>`;
        } else {
            html += `<p style="font-size:0.8rem;color:var(--slate-600);margin-bottom:0.75rem;"><strong>${nearbyPlaces.length} lugares</strong> dentro de ${radiusLabel}</p>`;
            nearbyPlaces.forEach(({place, map, distance}) => {
                const distLabel = distance >= 1000 ? `${(distance/1000).toFixed(1)} km` : `${Math.round(distance)} m`;
                html += `
                    <div class="nearby-card" data-place-id="${place.id}" data-map-id="${map.id}">
                        <div style="flex-shrink:0"><span class="nearby-distance-badge">${distLabel}</span></div>
                        <div class="nearby-info">
                            <h4>${esc(place.name)}</h4>
                            <p>${esc(map.title)}${place.category ? ' · ' + esc(place.category) : ''}</p>
                        </div>
                    </div>`;
            });
        }

        body.innerHTML = html;

        // Slider interaction
        const slider = document.getElementById('geo-radius-slider');
        const display = document.getElementById('radius-display');
        slider.addEventListener('input', () => {
            const v = parseInt(slider.value);
            display.textContent = v >= 1000 ? `${(v/1000).toFixed(1)} km` : `${v} m`;
        });
        slider.addEventListener('change', () => {
            this.geoRadius = parseInt(slider.value);
            this.showNearbyResults();
        });

        // Place click
        body.querySelectorAll('.nearby-card').forEach(card => {
            card.addEventListener('click', () => {
                AppStore.setActiveMap(card.dataset.mapId);
                setTimeout(() => AppStore.setSelectedPlace(card.dataset.placeId), 150);
            });
        });
    },

    /**
     * Haversine distance in meters
     */
    haversineDistance(lat1, lng1, lat2, lng2) {
        const R = 6371000;
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLng = (lng2 - lng1) * Math.PI / 180;
        const a = Math.sin(dLat/2)**2 + Math.cos(lat1 * Math.PI/180) * Math.cos(lat2 * Math.PI/180) * Math.sin(dLng/2)**2;
        return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    },

    getPlacesWithinRadius(radiusMeters) {
        if (!this.userLat || !this.userLng) return [];
        const results = [];

        MAPS_DATABASE.filter(m => m.status === 'published').forEach(map => {
            (map.places || []).forEach(place => {
                if (!place.lat || !place.lng) return;
                const d = this.haversineDistance(this.userLat, this.userLng, place.lat, place.lng);
                if (d <= radiusMeters) {
                    results.push({ place, map, distance: d });
                }
            });
        });

        return results.sort((a, b) => a.distance - b.distance);
    },

    // ────────────────────────────────────────────────────────────────────
    // MY MAPS MODE
    // ────────────────────────────────────────────────────────────────────
    // ────────────────────────────────────────────────────────────────────
    // SUMAR MAPA (indexar un mapa de Google My Maps o una lista de Google Maps)
    // ────────────────────────────────────────────────────────────────────
    CATEGORIES: ['Gastronomía', 'Cafeterías', 'Bares', 'Turismo', 'Barrios y Compras', 'Cultura'],

    indexShell(bodyHtml) {
        this.container.innerHTML = `
            <div class="expanded-panel-header">
                <span class="expanded-panel-title">＋ Sumar un mapa</span>
                <button class="panel-close-btn" id="rp-close">✕</button>
            </div>
            <div class="expanded-panel-body index-body">${bodyHtml}</div>`;
        document.getElementById('rp-close').addEventListener('click', () => this.close());
    },

    renderIndexMap() {
        this.indexData = null;
        const loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();

        if (!loggedIn) {
            this.indexShell(`
                <p class="account-lead">Sumá tus mapas a la comunidad</p>
                <p class="account-text">Para sumar un mapa necesitás entrar con tu cuenta de Google. Así cada mapa queda con el nombre de quien lo sumó.</p>
                <button type="button" class="google-btn" id="btn-index-login">
                    <span>Entrar con Google</span>
                </button>
            `);
            document.getElementById('btn-index-login').addEventListener('click', () => Auth.signIn());
            return;
        }

        this.indexShell(`
            <form id="index-form" class="create-form" novalidate>
                <div class="form-group">
                    <label class="form-label" for="ix-url">Link del mapa</label>
                    <input id="ix-url" class="form-input" type="url" inputmode="url" autocomplete="off"
                           placeholder="Pegá acá el link de Google" required>
                </div>
                <button type="submit" class="submit-create-btn" id="ix-search">Buscar mapa</button>
                <div id="ix-msg" class="index-msg" role="status"></div>
            </form>
            <div class="index-help">
                <p><strong>¿Qué links sirven?</strong></p>
                <p>🗺️ <strong>Mapas de Google My Maps</strong>: se traen todos sus lugares y se ven acá en el mapa.</p>
                <p>📋 <strong>Listas de Google Maps</strong> (links <em>maps.app.goo.gl</em>): se suman como tarjeta que abre la lista en Google Maps.</p>
                <p class="index-help-small">Tienen que ser públicos ("Cualquier persona con el vínculo").</p>
            </div>
        `);

        const form = document.getElementById('index-form');
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            this.indexFetchPreview(document.getElementById('ix-url').value.trim());
        });
        setTimeout(() => document.getElementById('ix-url')?.focus(), 50);
    },

    indexMessage(text, kind = 'info') {
        const el = document.getElementById('ix-msg');
        if (!el) return;
        el.className = 'index-msg ' + kind;
        el.textContent = text || '';
    },

    async indexFetchPreview(url) {
        if (!url) return this.indexMessage('Pegá un link para empezar.', 'error');
        const btn = document.getElementById('ix-search');
        btn.disabled = true;
        btn.textContent = 'Buscando…';
        this.indexMessage('Leyendo el mapa en Google… puede tardar unos segundos.');

        let data = null;
        try {
            const { data: ok, error } = await Auth.client.functions.invoke('indexar-mapa', { body: { url } });
            if (error) {
                // Las respuestas 4xx traen un JSON con el motivo
                try { data = await error.context.json(); } catch (e) { data = { ok: false, message: 'No pudimos leer ese link. Probá de nuevo.' }; }
            } else {
                data = ok;
            }
        } catch (e) {
            data = { ok: false, message: 'No pudimos conectarnos. Probá de nuevo en un rato.' };
        }

        btn.disabled = false;
        btn.textContent = 'Buscar mapa';

        if (data && data.ok) return this.renderIndexPreview(data);
        if (data && data.error === 'lista' && data.list_id) return this.renderIndexListForm(data, url);
        this.indexMessage((data && data.message) || 'No pudimos leer ese link.', 'error');
    },

    async findExisting(sourceMid) {
        if (!sourceMid) return null;
        try {
            const { data } = await Auth.client.from('maps').select('slug, title').eq('source_mid', sourceMid).maybeSingle();
            return data || null;
        } catch (e) { return null; }
    },

    categoryOptions(selected) {
        return this.CATEGORIES.map(c => `<option ${c === selected ? 'selected' : ''}>${esc(c)}</option>`).join('');
    },

    existingHtml(existing) {
        return `
            <div class="index-existing">
                <p><strong>Este mapa ya está en Mapa de Mapas</strong> como “${esc(existing.title)}”.</p>
                <button type="button" class="submit-create-btn" id="ix-open-existing">Ver el mapa</button>
                <button type="button" class="index-back" id="ix-back">Probar con otro link</button>
            </div>`;
    },

    bindExisting(existing) {
        document.getElementById('ix-open-existing')?.addEventListener('click', () => {
            this.close();
            AppStore.setActiveMap(existing.slug);
        });
        document.getElementById('ix-back')?.addEventListener('click', () => this.renderIndexMap());
    },

    async renderIndexPreview(data) {
        this.indexData = data;
        const existing = await this.findExisting(data.mid);
        if (existing) {
            this.indexShell(this.existingHtml(existing));
            return this.bindExisting(existing);
        }

        const sample = (data.places || []).slice(0, 5).map(p => `<li>${esc(p.name)}</li>`).join('');
        const more = data.places.length > 5 ? `<li class="index-more">y ${data.places.length - 5} más…</li>` : '';
        const withPhoto = data.places.filter(p => p.photo).length;

        this.indexShell(`
            <div class="index-found">
                <span class="index-found-badge">✅ Encontramos ${data.places.length} lugares</span>
                ${withPhoto ? `<span class="index-found-note">${withPhoto} con foto</span>` : ''}
                <ul class="index-sample">${sample}${more}</ul>
            </div>
            <form id="index-save-form" class="create-form" novalidate>
                <div class="form-group">
                    <label class="form-label" for="ix-title">Nombre del mapa *</label>
                    <input id="ix-title" class="form-input" type="text" maxlength="140" value="${esc(data.title || '')}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-author">Creado por *</label>
                    <input id="ix-author" class="form-input" type="text" maxlength="80" value="${esc(data.author || '')}"
                           placeholder="Nombre o @usuario de quien hizo el mapa" required>
                    ${data.author ? '<span class="form-hint">Lo sacamos de Google. Podés sumar su @ de Instagram.</span>' : '<span class="form-hint">Google no muestra el autor: escribilo vos (nombre o @usuario).</span>'}
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-desc">Descripción</label>
                    <textarea id="ix-desc" class="form-textarea" maxlength="2000">${esc(data.description || '')}</textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-category">Categoría</label>
                    <select id="ix-category" class="form-select">${this.categoryOptions('Gastronomía')}</select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-tags">Palabras clave (separadas por coma)</label>
                    <input id="ix-tags" class="form-input" type="text" placeholder="Ej: terraza, brunch, palermo">
                </div>
                <button type="submit" class="submit-create-btn" id="ix-save">Publicar mapa</button>
                <button type="button" class="index-back" id="ix-back">Cancelar</button>
                <div id="ix-msg" class="index-msg" role="status"></div>
            </form>
        `);

        document.getElementById('ix-back').addEventListener('click', () => this.renderIndexMap());
        document.getElementById('index-save-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIndexed('map');
        });
    },

    async renderIndexListForm(data, originalUrl) {
        this.indexData = Object.assign({}, data, { originalUrl });
        const existing = await this.findExisting(data.list_id);
        if (existing) {
            this.indexShell(this.existingHtml(existing));
            return this.bindExisting(existing);
        }

        this.indexShell(`
            <div class="index-found index-found--list">
                <span class="index-found-badge">📋 Es una lista de Google Maps</span>
                <p class="index-found-text">Google no deja traer sus lugares, así que se va a sumar como una tarjeta que abre la lista en Google Maps. Contanos de qué se trata para que la gente la encuentre.</p>
            </div>
            <form id="index-save-form" class="create-form" novalidate>
                <div class="form-group">
                    <label class="form-label" for="ix-title">Nombre de la lista *</label>
                    <input id="ix-title" class="form-input" type="text" maxlength="140" placeholder="Ej: Pizzerías de Almagro" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-author">Creada por *</label>
                    <input id="ix-author" class="form-input" type="text" maxlength="80" placeholder="Nombre o @usuario de quien hizo la lista" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-desc">Descripción</label>
                    <textarea id="ix-desc" class="form-textarea" maxlength="2000" placeholder="¿Qué lugares tiene?"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-category">Categoría</label>
                    <select id="ix-category" class="form-select">${this.categoryOptions('Gastronomía')}</select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="ix-tags">Palabras clave (separadas por coma)</label>
                    <input id="ix-tags" class="form-input" type="text" placeholder="Ej: pizza, almagro, barato">
                </div>
                <a class="source-link" href="${esc(data.source_url)}" target="_blank" rel="noopener">Abrir la lista para revisarla ↗</a>
                <button type="submit" class="submit-create-btn" id="ix-save">Publicar lista</button>
                <button type="button" class="index-back" id="ix-back">Cancelar</button>
                <div id="ix-msg" class="index-msg" role="status"></div>
            </form>
        `);

        document.getElementById('ix-back').addEventListener('click', () => this.renderIndexMap());
        document.getElementById('index-save-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.saveIndexed('list');
        });
    },

    slugify(s) {
        return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
            .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'mapa';
    },

    parseTags(s) {
        return [...new Set((s || '').split(',')
            .map(t => t.trim().replace(/^#/, '').toLowerCase())
            .filter(t => t && t.length <= 30))].slice(0, 8);
    },

    async saveIndexed(kind) {
        const data = this.indexData;
        if (!data || !Auth.isLoggedIn()) return;

        const title = document.getElementById('ix-title').value.trim();
        const author = document.getElementById('ix-author').value.trim();
        const description = document.getElementById('ix-desc').value.trim();
        const category = document.getElementById('ix-category').value;
        const tags = this.parseTags(document.getElementById('ix-tags').value);

        if (!title) { document.getElementById('ix-title').focus(); return this.indexMessage('Falta el nombre.', 'error'); }
        if (!author) { document.getElementById('ix-author').focus(); return this.indexMessage('Contanos quién lo creó.', 'error'); }

        const btn = document.getElementById('ix-save');
        btn.disabled = true;
        btn.textContent = 'Publicando…';
        this.indexMessage('');

        const isList = kind === 'list';
        const row = {
            title,
            description: description || null,
            category,
            tags,
            source: isList ? 'google_list' : 'google_mymaps',
            source_url: data.source_url,
            source_mid: isList ? data.list_id : data.mid,
            author_name: author,
            added_by: Auth.user.id,
            status: 'published',
            last_synced_at: isList ? null : new Date().toISOString()
        };

        // Insertar el mapa con un slug libre (si está tomado, se le agrega un sufijo)
        const base = this.slugify(title);
        let map = null, lastError = null;
        for (let i = 0; i < 4 && !map; i++) {
            const slug = i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
            const { data: inserted, error } = await Auth.client.from('maps')
                .insert(Object.assign({ slug }, row)).select('id, slug').single();
            if (!error) { map = inserted; break; }
            lastError = error;
            if (error.code === '23505' && /source_mid/.test(error.message || '')) {
                const existing = await this.findExisting(row.source_mid);
                if (existing) { this.indexShell(this.existingHtml(existing)); return this.bindExisting(existing); }
            }
            if (error.code !== '23505') break;
        }
        if (!map) {
            console.warn(lastError);
            btn.disabled = false;
            btn.textContent = isList ? 'Publicar lista' : 'Publicar mapa';
            return this.indexMessage('No se pudo publicar. Probá de nuevo en un rato.', 'error');
        }

        // Cargar los lugares (solo mapas de My Maps)
        if (!isList) {
            const places = data.places.map((p, i) => ({
                map_id: map.id,
                key: `${map.slug}-${i}`,
                name: (p.name || 'Sin nombre').slice(0, 300),
                category: p.layer || null,
                address: p.address || null,
                lat: p.lat,
                lng: p.lng,
                description: p.description || null,
                photo: p.photo || null,
                position: i
            }));
            for (let i = 0; i < places.length; i += 500) {
                const { error } = await Auth.client.from('places').insert(places.slice(i, i + 500));
                if (error) {
                    console.warn(error);
                    await Auth.client.from('maps').delete().eq('id', map.id); // no dejar mapas a medias
                    btn.disabled = false;
                    btn.textContent = 'Publicar mapa';
                    return this.indexMessage('No se pudieron guardar los lugares. Probá de nuevo.', 'error');
                }
            }
        }

        // Listo: recargar los mapas y abrir el nuevo
        this.close();
        if (typeof alertSafe === 'function') alertSafe(isList ? '¡Listo! Tu lista ya está publicada.' : '¡Listo! Tu mapa ya está publicado.');
        if (typeof DataSource !== 'undefined') await DataSource.load();
        if (isList) {
            AppStore.setActiveMap(null);
            AppStore.setSearchQuery('');
        } else {
            AppStore.setActiveMap(map.slug);
        }
    },

    // ────────────────────────────────────────────────────────────────────
    // CUENTA (login con Google)
    // ────────────────────────────────────────────────────────────────────
    updateAccountButton() {
        if (!this.btnAccount || typeof Auth === 'undefined') return;
        const icon = this.btnAccount.querySelector('.btn-icon');
        const label = this.btnAccount.querySelector('.btn-label');
        if (Auth.isLoggedIn()) {
            const avatar = Auth.profile && Auth.profile.avatar_url;
            icon.innerHTML = avatar
                ? `<img class="account-avatar" src="${escapeHtml(avatar)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.replaceWith(document.createTextNode('👤'))">`
                : '👤';
            label.textContent = Auth.firstName().slice(0, 9);
            this.btnAccount.setAttribute('aria-label', 'Tu cuenta: ' + Auth.firstName());
        } else {
            icon.textContent = '👤';
            label.textContent = 'Entrar';
            this.btnAccount.setAttribute('aria-label', 'Entrar con Google');
        }
    },

    renderAccount() {
        const loggedIn = typeof Auth !== 'undefined' && Auth.isLoggedIn();
        const available = typeof Auth !== 'undefined' && !!Auth.client;
        let body;

        if (!available) {
            body = `<p class="account-text">El login no está disponible en este momento. Podés seguir explorando todos los mapas.</p>`;
        } else if (!loggedIn) {
            body = `
                <p class="account-lead">Explorar es libre, sin registrarte.</p>
                <p class="account-text">Entrá con tu cuenta de Google para guardar mapas y, muy pronto, sumar los tuyos a la comunidad.</p>
                <button type="button" class="google-btn" id="btn-google-login">
                    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
                    <span>Continuar con Google</span>
                </button>
                <p class="account-note">Solo usamos tu nombre, tu mail y tu foto de Google.</p>
            `;
        } else {
            const p = Auth.profile || {};
            const avatar = p.avatar_url
                ? `<img class="account-big-avatar" src="${escapeHtml(p.avatar_url)}" alt="" referrerpolicy="no-referrer" onerror="this.onerror=null;this.style.display='none'">`
                : `<div class="account-big-avatar account-big-avatar--empty">👤</div>`;
            body = `
                <div class="account-card">
                    ${avatar}
                    <div>
                        <div class="account-name">${escapeHtml(p.display_name || Auth.firstName())}</div>
                        <div class="account-email">${escapeHtml(Auth.user.email || '')}</div>
                        ${Auth.isAdmin() ? '<span class="account-badge">Administrador</span>' : ''}
                    </div>
                </div>
                <p class="account-text">Ya estás dentro. Pronto vas a poder guardar mapas en tu cuenta y sumar los tuyos.</p>
                <button type="button" class="account-logout" id="btn-logout">Cerrar sesión</button>
            `;
        }

        this.container.innerHTML = `
            <div class="expanded-panel-header">
                <span class="expanded-panel-title">👤 Tu cuenta</span>
                <button class="panel-close-btn" id="rp-close">✕</button>
            </div>
            <div class="expanded-panel-body account-body">${body}</div>
        `;

        document.getElementById('rp-close').addEventListener('click', () => this.close());
        const loginBtn = document.getElementById('btn-google-login');
        if (loginBtn) loginBtn.addEventListener('click', () => {
            loginBtn.disabled = true;
            loginBtn.querySelector('span').textContent = 'Abriendo Google…';
            Auth.signIn();
        });
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) logoutBtn.addEventListener('click', async () => {
            logoutBtn.disabled = true;
            await Auth.signOut();
        });
    },

    renderMyMaps() {
        const created = Identity.getCreatedMaps();
        const saved = Identity.getSavedMaps();

        const renderMiniCards = (maps, emptyMsg) => {
            if (maps.length === 0) {
                return `<div class="empty-my-maps"><p>${emptyMsg}</p></div>`;
            }
            return maps.map(m => `
                <div class="mini-map-card" data-map-id="${m.id}">
                    <img src="${m.coverImage || 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=200'}" 
                         alt="" class="mini-map-img" loading="lazy">
                    <div class="mini-map-info">
                        <h4>${esc(m.title)}</h4>
                        <p>${m.status === 'draft' ? 'Borrador' : (m.places || []).length + ' lugares'} • ${esc(m.category)}</p>
                    </div>
                </div>
            `).join('');
        };

        this.container.innerHTML = `
            <div class="expanded-panel-header">
                <span class="expanded-panel-title">🗺️ Mis Mapas</span>
                <button class="panel-close-btn" id="rp-close">✕</button>
            </div>
            <div class="expanded-panel-body">
                <div class="my-maps-section">
                    <div class="my-maps-section-title">📌 Creados por mí (${created.length})</div>
                    ${renderMiniCards(created, '¡Todavía no creaste ningún mapa! Usá el botón ＋ para empezar.')}
                </div>
                <div class="my-maps-section">
                    <div class="my-maps-section-title">❤️ Guardados (${saved.length})</div>
                    ${renderMiniCards(saved, 'Explorá el catálogo y tocá ☆ en cualquier mapa para guardarlo acá.')}
                </div>
            </div>
        `;

        document.getElementById('rp-close').addEventListener('click', () => this.close());

        this.container.querySelectorAll('.mini-map-card').forEach(card => {
            card.addEventListener('click', () => {
                AppStore.setActiveMap(card.dataset.mapId);
                this.close();
            });
        });
    },

    // ────────────────────────────────────────────────────────────────────
    // CREATE MAP MODE
    // ────────────────────────────────────────────────────────────────────
    renderCreateMap() {
        this.pendingPlaces = [];

        this.container.innerHTML = `
            <div class="expanded-panel-header">
                <span class="expanded-panel-title">＋ Crear Mapa</span>
                <button class="panel-close-btn" id="rp-close">✕</button>
            </div>
            <div class="expanded-panel-body">
                <form class="create-form" id="create-map-form">
                    <div class="form-group">
                        <label class="form-label">Nombre del mapa *</label>
                        <input id="fm-title" class="form-input" type="text" placeholder="Ej: Mis bodegones favoritos" required>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Descripción</label>
                        <textarea id="fm-desc" class="form-textarea" placeholder="¿De qué se trata este mapa?"></textarea>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Categoría</label>
                        <select id="fm-category" class="form-select">
                            <option>Gastronomía</option>
                            <option>Cafeterías</option>
                            <option>Bares</option>
                            <option>Turismo</option>
                            <option>Barrios y Compras</option>
                            <option>Cultura</option>
                        </select>
                    </div>
                    <div class="form-group">
                        <label class="form-label">Tags (separados por coma)</label>
                        <input id="fm-tags" class="form-input" type="text" placeholder="Ej: terraza, soleado, brunch">
                    </div>
                    <div class="form-group">
                        <label class="form-label">🔍 Agregar lugares</label>
                        <input id="fm-place-search" class="form-input" type="text" placeholder="Buscar un lugar real (ej: La Mezzetta)..." autocomplete="off">
                        <div id="place-search-results" class="place-search-results" style="display:none;"></div>
                    </div>
                    <div id="added-places-container" style="display:none;">
                        <label class="form-label">Lugares agregados</label>
                        <div class="added-places-list" id="added-places-list"></div>
                    </div>
                    <button type="submit" class="submit-create-btn" id="submit-create-btn">
                        Crear Mapa
                    </button>

                    <div style="text-align:center;margin-top:0.75rem;">
                        <button type="button" id="import-kml-toggle" style="background:none;border:none;color:var(--primary);font-size:0.82rem;font-weight:700;font-family:inherit;cursor:pointer;text-decoration:underline;">
                            O bien, importar desde KML / GeoJSON
                        </button>
                    </div>
                    <div id="kml-import-section" style="display:none;margin-top:0.75rem;">
                        <div class="importer-box" id="drop-importer-box-create" style="border:2px dashed var(--slate-300);border-radius:var(--radius-md);padding:1rem;text-align:center;background:var(--slate-50);cursor:pointer;">
                            <div style="font-size:1.4rem;margin-bottom:0.3rem;">📁</div>
                            <div style="font-size:0.82rem;font-weight:700;color:var(--navy-900);">Arrastrá un archivo aquí o hacé clic</div>
                            <div style="font-size:0.72rem;color:var(--slate-600);">Formatos: .kml, .geojson</div>
                            <input type="file" id="kml-import-input" accept=".kml,.geojson,.json" style="display:none;">
                        </div>
                        <div id="kml-preview" style="display:none;margin-top:0.75rem;padding:0.75rem;background:var(--primary-light);border-radius:var(--radius-md);border:1px solid var(--primary);">
                            <p id="kml-preview-msg" style="font-size:0.85rem;font-weight:700;color:var(--primary);margin-bottom:0.5rem;"></p>
                            <button id="kml-confirm-btn" class="submit-create-btn" style="margin-top:0;">✅ Confirmar e importar</button>
                            <button id="kml-cancel-btn" style="background:none;border:none;color:var(--slate-600);font-size:0.8rem;font-family:inherit;cursor:pointer;margin-top:0.4rem;display:block;width:100%;text-align:center;">Cancelar</button>
                        </div>
                    </div>
                </form>
            </div>
        `;

        document.getElementById('rp-close').addEventListener('click', () => this.close());
        this.setupPlaceSearch();
        this.setupKmlImporter();

        document.getElementById('create-map-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.submitCreateMap();
        });
    },

    setupKmlImporter() {
        const toggle = document.getElementById('import-kml-toggle');
        const section = document.getElementById('kml-import-section');
        const box = document.getElementById('drop-importer-box-create');
        const fileInput = document.getElementById('kml-import-input');
        const preview = document.getElementById('kml-preview');
        const previewMsg = document.getElementById('kml-preview-msg');
        let parsedPlaces = [];
        let parsedFileName = '';

        toggle.addEventListener('click', () => {
            section.style.display = section.style.display === 'none' ? 'block' : 'none';
        });

        box.addEventListener('click', () => fileInput.click());
        ['dragenter', 'dragover'].forEach(e => box.addEventListener(e, ev => { ev.preventDefault(); box.style.borderColor = 'var(--primary)'; }));
        ['dragleave', 'drop'].forEach(e => box.addEventListener(e, ev => { ev.preventDefault(); box.style.borderColor = ''; }));
        box.addEventListener('drop', ev => { const f = ev.dataTransfer.files[0]; if (f) processFile(f); });
        fileInput.addEventListener('change', ev => { if (ev.target.files[0]) processFile(ev.target.files[0]); });

        const processFile = (file) => {
            parsedFileName = file.name.replace(/\.[^/.]+$/, '');
            previewMsg.textContent = '⏳ Procesando archivo...';
            preview.style.display = 'block';

            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    if (file.name.endsWith('.kml')) {
                        parsedPlaces = GeoJsonParser.parseKML(e.target.result);
                    } else {
                        parsedPlaces = GeoJsonParser.parseGeoJSON(JSON.parse(e.target.result));
                    }
                    if (parsedPlaces.length > 0) {
                        previewMsg.textContent = `✅ Se encontraron ${parsedPlaces.length} lugares en "${parsedFileName}". ¿Confirmar importación?`;
                    } else {
                        previewMsg.textContent = '⚠️ No se encontraron coordenadas válidas en el archivo.';
                        document.getElementById('kml-confirm-btn').style.display = 'none';
                    }
                } catch(err) {
                    previewMsg.textContent = '❌ Error al procesar el archivo. Verificá que sea un KML o GeoJSON válido.';
                    document.getElementById('kml-confirm-btn').style.display = 'none';
                }
            };
            reader.readAsText(file);
        };

        document.getElementById('kml-confirm-btn').addEventListener('click', () => {
            const title = document.getElementById('fm-title').value.trim() || parsedFileName;
            const category = document.getElementById('fm-category').value;
            const tagsRaw = document.getElementById('fm-tags').value;
            const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

            const newMap = {
                id: `imported-${Date.now()}`,
                status: parsedPlaces.length > 0 ? 'published' : 'draft',
                title,
                category,
                curator: '@yo',
                description: document.getElementById('fm-desc').value.trim() || `Mapa importado con ${parsedPlaces.length} lugares.`,
                coverImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800',
                tags,
                places: parsedPlaces
            };

            Identity.saveCreatedMap(newMap);

            this.container.querySelector('.expanded-panel-body').innerHTML = `
                <div class="geo-state">
                    <div class="geo-state-icon">🎉</div>
                    <div class="geo-state-title">¡Mapa importado!</div>
                    <p class="geo-state-desc">${title} fue creado con ${parsedPlaces.length} lugares.</p>
                    <button id="go-to-new-map" style="margin-top:1rem;background:var(--primary);color:white;border:none;border-radius:9999px;padding:0.7rem 1.25rem;font-weight:700;font-size:0.9rem;font-family:inherit;cursor:pointer;">Ver mi mapa</button>
                </div>`;

            document.getElementById('go-to-new-map').addEventListener('click', () => {
                AppStore.setActiveMap(newMap.id);
                this.close();
            });
        });

        document.getElementById('kml-cancel-btn').addEventListener('click', () => {
            preview.style.display = 'none';
            parsedPlaces = [];
        });
    },

    setupPlaceSearch() {
        const input = document.getElementById('fm-place-search');
        const resultsEl = document.getElementById('place-search-results');

        input.addEventListener('input', () => {
            clearTimeout(this.searchDebounceTimer);
            const q = input.value.trim();

            if (q.length < 3) {
                resultsEl.style.display = 'none';
                return;
            }

            this.searchDebounceTimer = setTimeout(() => {
                this.searchPlacesNominatim(q, resultsEl);
            }, 400);
        });
    },

    async searchPlacesNominatim(query, resultsEl) {
        resultsEl.style.display = 'block';
        resultsEl.innerHTML = `<div class="place-result-item"><span style="color:var(--slate-400)">Buscando...</span></div>`;

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&countrycodes=ar&limit=6&addressdetails=1`;
            const res = await fetch(url, {
                headers: { 'Accept-Language': 'es' }
            });
            const data = await res.json();

            if (!data || data.length === 0) {
                resultsEl.innerHTML = `<div class="place-result-item"><span style="color:var(--slate-400)">Sin resultados para "${query}"</span></div>`;
                return;
            }

            resultsEl.innerHTML = data.map((item, i) => {
                const name = item.namedetails?.name || item.display_name.split(',')[0];
                const addr = item.display_name;
                return `
                    <div class="place-result-item" data-idx="${i}" 
                         data-lat="${item.lat}" data-lng="${item.lon}"
                         data-name="${name}" data-addr="${addr}">
                        <span class="place-result-icon">📍</span>
                        <div>
                            <div class="place-result-name">${name}</div>
                            <div class="place-result-addr">${addr.length > 60 ? addr.slice(0, 60) + '…' : addr}</div>
                        </div>
                    </div>
                `;
            }).join('');

            resultsEl.querySelectorAll('.place-result-item').forEach(item => {
                item.addEventListener('click', () => {
                    this.addPendingPlace({
                        id: `new-${Date.now()}-${Math.random().toString(36).slice(2)}`,
                        name: item.dataset.name,
                        address: item.dataset.addr,
                        lat: parseFloat(item.dataset.lat),
                        lng: parseFloat(item.dataset.lng),
                        category: 'Lugar',
                        description: 'Lugar agregado desde el buscador.',
                        tags: [],
                        photo: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800'
                    });
                    document.getElementById('fm-place-search').value = '';
                    resultsEl.style.display = 'none';
                });
            });
        } catch (err) {
            resultsEl.innerHTML = `<div class="place-result-item"><span style="color:var(--slate-400)">Error al buscar. Revisá tu conexión.</span></div>`;
        }
    },

    addPendingPlace(place) {
        if (this.pendingPlaces.find(p => p.name === place.name)) return;
        this.pendingPlaces.push(place);
        this.renderPendingPlaces();
    },

    removePendingPlace(id) {
        this.pendingPlaces = this.pendingPlaces.filter(p => p.id !== id);
        this.renderPendingPlaces();
    },

    renderPendingPlaces() {
        const container = document.getElementById('added-places-container');
        const list = document.getElementById('added-places-list');

        if (this.pendingPlaces.length === 0) {
            container.style.display = 'none';
            return;
        }

        container.style.display = 'block';
        list.innerHTML = this.pendingPlaces.map(p => `
            <div class="added-place-item">
                <span class="added-place-name">📍 ${esc(p.name)}</span>
                <button class="remove-place-btn" data-id="${p.id}">✕</button>
            </div>
        `).join('');

        list.querySelectorAll('.remove-place-btn').forEach(btn => {
            btn.addEventListener('click', () => this.removePendingPlace(btn.dataset.id));
        });
    },

    submitCreateMap() {
        const title = document.getElementById('fm-title').value.trim();
        if (!title) {
            document.getElementById('fm-title').focus();
            return;
        }

        const desc = document.getElementById('fm-desc').value.trim();
        const category = document.getElementById('fm-category').value;
        const tagsRaw = document.getElementById('fm-tags').value;
        const tags = tagsRaw.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);

        const newMap = {
            id: `user-${Date.now()}`,
            status: this.pendingPlaces.length > 0 ? 'published' : 'draft',
            title,
            category,
            curator: '@yo',
            description: desc || `Mapa creado por usuario.`,
            coverImage: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?q=80&w=800',
            tags,
            places: this.pendingPlaces
        };

        Identity.saveCreatedMap(newMap);

        // Show success
        this.container.querySelector('.expanded-panel-body').innerHTML = `
            <div class="geo-state">
                <div class="geo-state-icon">🎉</div>
                <div class="geo-state-title">¡Mapa creado!</div>
                <p class="geo-state-desc">${title} fue creado ${newMap.status === 'published' ? 'y publicado con ' + this.pendingPlaces.length + ' lugares' : 'como borrador'}.</p>
                <button id="go-to-new-map" style="margin-top:1rem; background:var(--primary); color:white; border:none; border-radius:9999px; padding:0.7rem 1.25rem; font-weight:700; font-size:0.9rem; font-family:inherit; cursor:pointer;">
                    Ver mi mapa
                </button>
            </div>
        `;

        document.getElementById('go-to-new-map').addEventListener('click', () => {
            AppStore.setActiveMap(newMap.id);
            this.close();
        });
    }
};
