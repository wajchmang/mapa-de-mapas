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
                });
            }
            this.updateAccountButton();
        }

        this.btnGeo.addEventListener('click', () => this.toggleMode('geo'));
        this.btnMyMaps.addEventListener('click', () => this.toggleMode('myMaps'));
        this.btnCreate.addEventListener('click', () => this.toggleMode('createMap'));
    },

    toggleMode(newMode) {
        if (this.mode === newMode) {
            this.close();
            return;
        }
        this.mode = newMode;

        // Update button active states
        this.allButtons().forEach(b => b.classList.remove('active'));
        const activeBtn = { account: this.btnAccount, geo: this.btnGeo, myMaps: this.btnMyMaps, createMap: this.btnCreate }[newMode];
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
                            <h4>${place.name}</h4>
                            <p>${map.title} · ${place.category}</p>
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
                         alt="${m.title}" class="mini-map-img" loading="lazy">
                    <div class="mini-map-info">
                        <h4>${m.title}</h4>
                        <p>${m.status === 'draft' ? 'Borrador' : (m.places || []).length + ' lugares'} • ${m.category}</p>
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
                <span class="added-place-name">📍 ${p.name}</span>
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
