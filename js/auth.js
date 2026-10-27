/**
 * auth.js — Login con Google vía Supabase
 *
 * Explorar el sitio nunca requiere login. Entrar con Google habilita
 * (en próximas versiones) guardar mapas y sumar mapas a la comunidad.
 * Solo se usan nombre, mail y foto de la cuenta de Google.
 */
const Auth = {
    client: null,
    user: null,      // usuario de Supabase (o null)
    profile: null,   // { display_name, avatar_url, is_admin }
    ready: false,
    listeners: [],

    init() {
        if (!window.supabase || !CONFIG.SUPABASE_URL || !CONFIG.SUPABASE_KEY) {
            console.warn('Auth: Supabase no está disponible; el sitio sigue funcionando sin login.');
            this.ready = true;
            return;
        }
        try {
            this.client = window.supabase.createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY, {
                auth: { flowType: 'pkce', persistSession: true, detectSessionInUrl: true, autoRefreshToken: true }
            });
        } catch (err) {
            console.warn('Auth: no se pudo iniciar Supabase', err);
            this.ready = true;
            return;
        }

        // No llamar a Supabase directamente dentro de este callback (recomendación oficial):
        // se difiere con setTimeout.
        this.client.auth.onAuthStateChange((_event, session) => {
            setTimeout(() => this.handleSession(session), 0);
        });
    },

    async handleSession(session) {
        const prevId = this.user ? this.user.id : null;
        this.user = session ? session.user : null;

        if (this.user && this.user.id !== prevId) {
            this.profile = await this.loadProfile(this.user);
            this.restoreReturnHash();
        } else if (!this.user) {
            this.profile = null;
        }
        this.ready = true;
        this.notify();
    },

    async loadProfile(user) {
        const meta = user.user_metadata || {};
        const fallback = {
            display_name: meta.full_name || meta.name || (user.email || '').split('@')[0],
            avatar_url: meta.avatar_url || meta.picture || null,
            is_admin: false
        };
        try {
            const { data, error } = await this.client
                .from('profiles')
                .select('display_name, avatar_url, is_admin')
                .eq('id', user.id)
                .maybeSingle();
            if (error || !data) return fallback;
            return {
                display_name: data.display_name || fallback.display_name,
                avatar_url: data.avatar_url || fallback.avatar_url,
                is_admin: !!data.is_admin
            };
        } catch (e) {
            return fallback;
        }
    },

    isLoggedIn() {
        return !!this.user;
    },

    isAdmin() {
        return !!(this.profile && this.profile.is_admin);
    },

    firstName() {
        const name = (this.profile && this.profile.display_name) || '';
        return name.split(' ')[0] || 'Vos';
    },

    async signIn() {
        if (!this.client) return;
        // Recordar en qué mapa estaba la persona para volver ahí después del login
        try { sessionStorage.setItem('mdm_return_hash', window.location.hash || ''); } catch (e) { /* sin storage */ }
        const { error } = await this.client.auth.signInWithOAuth({
            provider: 'google',
            options: { redirectTo: window.location.origin + window.location.pathname }
        });
        if (error) alertSafe('No se pudo iniciar sesión con Google. Probá de nuevo en un rato.');
    },

    async signOut() {
        if (!this.client) return;
        await this.client.auth.signOut();
    },

    restoreReturnHash() {
        let hash = '';
        try {
            hash = sessionStorage.getItem('mdm_return_hash') || '';
            sessionStorage.removeItem('mdm_return_hash');
        } catch (e) { /* sin storage */ }
        if (hash && hash.length > 1 && !window.location.hash) {
            window.location.hash = hash; // dispara hashchange → App vuelve a ese mapa
        }
    },

    subscribe(fn) {
        this.listeners.push(fn);
    },

    notify() {
        this.listeners.forEach(fn => {
            try { fn(this); } catch (e) { console.warn(e); }
        });
    }
};

/** Mensaje simple sin bloquear la página con alert() */
function alertSafe(msg) {
    console.warn(msg);
    const el = document.createElement('div');
    el.className = 'mdm-toast';
    el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 4000);
}

/** Escapa texto que viene de afuera (nombres, mails) antes de ponerlo en HTML */
function escapeHtml(str) {
    return String(str == null ? '' : str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Arranca apenas se carga el script, antes de que la app toque la dirección
Auth.init();
