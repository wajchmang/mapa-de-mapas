/**
 * mobile-sheet.js — Panel inferior deslizable para celulares (≤ 768px)
 *
 * Tres alturas:
 *   - 'peek' → solo buscador + categorías; el mapa ocupa casi toda la pantalla
 *   - 'half' → mitad de pantalla (detalle de un lugar, lista de lugares)
 *   - 'full' → casi toda la pantalla (elegir entre mapas de una categoría)
 *
 * Se mueve solo según lo que hace la persona (tocar categoría, elegir mapa,
 * elegir lugar, mover el mapa) y también se puede arrastrar con el dedo
 * desde la manija de arriba.
 */
const MobileSheet = {
    BREAKPOINT: 768,
    FULL_TOP_GAP: 64,     // espacio libre arriba en modo 'full' (deja ver el sello)
    HALF_RATIO: 0.5,

    sheet: null,
    header: null,
    handle: null,
    state: 'peek',
    prev: null,
    drag: null,

    isMobile() {
        return window.innerWidth <= this.BREAKPOINT;
    },

    // ── Alturas en píxeles ──────────────────────────────────────────────
    viewportHeight() {
        return window.innerHeight;
    },

    peekHeight() {
        if (!this.handle || !this.header) return 160;
        return this.handle.offsetHeight + this.header.offsetHeight + 4;
    },

    halfHeight() {
        return Math.round(this.viewportHeight() * this.HALF_RATIO);
    },

    fullHeight() {
        return this.viewportHeight() - this.FULL_TOP_GAP;
    },

    heightFor(state) {
        if (state === 'full') return this.fullHeight();
        if (state === 'half') return Math.max(this.halfHeight(), this.peekHeight());
        return this.peekHeight();
    },

    // ── Inicio ──────────────────────────────────────────────────────────
    init() {
        this.sheet = document.getElementById('sidebar-container');
        this.header = this.sheet.querySelector('.sidebar-header');
        this.handle = this.sheet.querySelector('.mobile-handlebar');
        if (!this.sheet || !this.header || !this.handle) return;

        this.prev = this.snapshot();
        // Si se entró con un link directo a un lugar, arrancar a mitad de pantalla
        if (AppStore.state.selectedPlaceId) this.state = 'half';

        this.bindStamp();
        this.bindDrag();
        this.bindSearchFocus();
        this.bindMapGestures();
        this.bindRightPanel();

        AppStore.subscribe(() => this.onStoreChange());

        window.addEventListener('resize', () => this.apply(false));
        window.addEventListener('orientationchange', () => setTimeout(() => this.apply(false), 200));

        // Las fuentes cambian la altura del encabezado: recalcular cuando cargan
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(() => this.apply(false));
        }

        this.apply(false);
    },

    snapshot() {
        const s = AppStore.state;
        return {
            activeMapId: s.activeMapId,
            selectedPlaceId: s.selectedPlaceId,
            activeCategory: s.activeCategory,
            searchQuery: s.searchQuery,
            viewMode: s.viewMode
        };
    },

    // ── Cambiar de altura ───────────────────────────────────────────────
    setState(state, animate = true) {
        this.state = state;
        this.apply(animate);
    },

    apply(animate = true) {
        const root = document.documentElement;

        if (!this.isMobile()) {
            // En desktop no tocamos nada: el layout de siempre
            this.sheet.style.height = '';
            this.sheet.classList.remove('sheet-peek', 'sheet-half', 'sheet-full', 'sheet-dragging');
            root.style.removeProperty('--sheet-h');
            return;
        }

        const h = this.heightFor(this.state);
        this.sheet.classList.toggle('sheet-dragging', !animate);
        this.sheet.style.height = h + 'px';
        this.sheet.classList.remove('sheet-peek', 'sheet-half', 'sheet-full');
        this.sheet.classList.add('sheet-' + this.state);
        root.style.setProperty('--sheet-h', h + 'px');

        if (!animate) {
            // Forzar repintado y volver a activar la animación
            void this.sheet.offsetHeight;
            this.sheet.classList.remove('sheet-dragging');
        }
    },

    // ── Reacciones automáticas a lo que hace la persona ─────────────────
    onStoreChange() {
        const now = this.snapshot();
        const before = this.prev;
        this.prev = now;
        if (!this.isMobile()) return;

        // Eligió un lugar (en la lista o tocando un pin) → mitad de pantalla
        if (now.selectedPlaceId && now.selectedPlaceId !== before.selectedPlaceId) {
            return this.setState('half');
        }

        // Eligió un mapa → bajar el panel para ver los lugares en el mapa
        if (now.activeMapId && now.activeMapId !== before.activeMapId) {
            return this.setState('peek');
        }

        // Volvió de un lugar a la lista de lugares → mitad
        if (!now.selectedPlaceId && before.selectedPlaceId && now.activeMapId) {
            return this.setState('half');
        }

        // Volvió al catálogo desde un mapa → mostrar el catálogo completo
        if (!now.activeMapId && before.activeMapId) {
            return this.setState(this.resettingToHome ? 'peek' : 'full');
        }

        // Tocó una categoría, cambió de pestaña o está buscando → agrandar
        if (now.activeCategory !== before.activeCategory ||
            now.viewMode !== before.viewMode ||
            (now.searchQuery && now.searchQuery !== before.searchQuery)) {
            return this.setState('full');
        }
    },

    // ── Sello del logo: vuelve al inicio ────────────────────────────────
    bindStamp() {
        const stamp = document.getElementById('brand-stamp');
        if (!stamp) return;
        stamp.addEventListener('click', (e) => {
            e.preventDefault();
            this.resettingToHome = true;
            AppStore.resetToCatalog();
            this.resettingToHome = false;
            if (typeof RightPanel !== 'undefined' && RightPanel.close) RightPanel.close();
            this.setState('peek');
        });
    },

    // ── Buscar → agrandar para ver resultados ───────────────────────────
    bindSearchFocus() {
        const input = document.getElementById('search-input');
        if (!input) return;
        input.addEventListener('focus', () => {
            if (this.isMobile() && this.state !== 'full') this.setState('full');
        });
    },

    // ── Tocar o mover el mapa → bajar el panel ──────────────────────────
    bindMapGestures() {
        if (typeof MapEngine === 'undefined' || !MapEngine.map) return;
        MapEngine.map.on('dragstart', () => {
            if (this.isMobile() && this.state === 'full') this.setState('peek');
        });
        MapEngine.map.on('click', () => {
            if (this.isMobile() && this.state === 'full') this.setState('peek');
        });
    },

    // ── Al abrir Mis Mapas / Cerca tuyo / Crear, bajar el panel ─────────
    bindRightPanel() {
        document.querySelectorAll('.right-action-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                if (this.isMobile() && this.state !== 'peek') this.setState('peek');
            });
        });
    },

    // ── Arrastrar con el dedo desde la manija ───────────────────────────
    bindDrag() {
        const onStart = (y) => {
            if (!this.isMobile()) return;
            this.drag = { startY: y, startH: this.sheet.offsetHeight, lastY: y, lastT: Date.now(), v: 0, moved: false };
            this.sheet.classList.add('sheet-dragging');
        };

        const onMove = (y) => {
            if (!this.drag) return;
            const now = Date.now();
            const dy = y - this.drag.startY;
            if (Math.abs(dy) > 4) this.drag.moved = true;
            const dt = Math.max(now - this.drag.lastT, 1);
            this.drag.v = (y - this.drag.lastY) / dt; // px/ms, positivo = hacia abajo
            this.drag.lastY = y;
            this.drag.lastT = now;

            const h = Math.min(this.fullHeight(), Math.max(this.peekHeight() * 0.8, this.drag.startH - dy));
            this.sheet.style.height = h + 'px';
            document.documentElement.style.setProperty('--sheet-h', h + 'px');
        };

        const onEnd = () => {
            if (!this.drag) return;
            const { moved, v } = this.drag;
            const h = this.sheet.offsetHeight;
            this.drag = null;
            this.sheet.classList.remove('sheet-dragging');

            // Un toque sin arrastrar: pasar a la siguiente altura
            if (!moved) {
                const next = { peek: 'half', half: 'full', full: 'peek' }[this.state];
                return this.setState(next);
            }

            // Un "flick" rápido manda en la dirección del gesto
            if (v < -0.5) return this.setState(this.nearestAbove(h));
            if (v > 0.5) return this.setState(this.nearestBelow(h));

            // Si no, la altura más cercana
            const order = ['peek', 'half', 'full'];
            let best = 'peek', bestDist = Infinity;
            order.forEach(s => {
                const d = Math.abs(this.heightFor(s) - h);
                if (d < bestDist) { best = s; bestDist = d; }
            });
            this.setState(best);
        };

        // Zona de arrastre: la manija
        this.handle.addEventListener('touchstart', (e) => { this.lastTouch = Date.now(); onStart(e.touches[0].clientY); }, { passive: true });
        this.handle.addEventListener('touchmove', (e) => { if (this.drag) { e.preventDefault(); onMove(e.touches[0].clientY); } }, { passive: false });
        this.handle.addEventListener('touchend', onEnd);
        this.handle.addEventListener('touchcancel', onEnd);

        // También con mouse (para probar en la compu con la ventana angosta)
        this.handle.addEventListener('mousedown', (e) => {
            // En celulares el navegador también "simula" el mouse después del toque: ignorarlo
            if (this.lastTouch && Date.now() - this.lastTouch < 800) return;
            onStart(e.clientY);
            const move = (ev) => onMove(ev.clientY);
            const up = () => { onEnd(); window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
            window.addEventListener('mousemove', move);
            window.addEventListener('mouseup', up);
        });
    },

    nearestAbove(h) {
        const order = ['peek', 'half', 'full'];
        return order.find(s => this.heightFor(s) > h + 10) || 'full';
    },

    nearestBelow(h) {
        const order = ['full', 'half', 'peek'];
        return order.find(s => this.heightFor(s) < h - 10) || 'peek';
    }
};

document.addEventListener('DOMContentLoaded', () => MobileSheet.init());
