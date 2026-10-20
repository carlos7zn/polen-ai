// Profile page logic
function authHeaders(extra = {}) {
    return { 'Authorization': 'Bearer ' + localStorage.getItem('polen_token'), ...extra };
}

function forceLogout() {
    localStorage.removeItem('polen_token');
    localStorage.removeItem('polen_user');
    window.location.href = '/';
}

function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatDate(dateStr) {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('es-ES', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatRelativeTime(dateStr) {
    if (!dateStr) return 'Nunca';
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Ahora mismo';
    if (diffMins < 60) return `hace ${diffMins} min`;
    if (diffHours < 24) return `hace ${diffHours} h`;
    if (diffDays < 7) return `hace ${diffDays} d`;
    return formatDate(dateStr);
}

function getPlanLabel(plan) {
    const labels = {
        'free': 'Gratuito',
        'pro': 'Pro',
        'premium': 'Premium'
    };
    return labels[plan] || plan;
}

function getPlanClass(plan) {
    return `plan-${plan}`;
}

// DOM elements for error state
let profileCard = null;
let errorState = null;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('polen_token');
    const user = localStorage.getItem('polen_user');

    if (!token || !user) {
        window.location.href = '/';
        return;
    }

    // Cache DOM elements
    profileCard = document.querySelector('.profile-card');
    errorState = document.getElementById('errorState');

    // Setup logout
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('¿Cerrar sesión?')) forceLogout();
    });

    // New chat button
    document.getElementById('newChatBtn').addEventListener('click', () => {
        window.location.href = '/chat.html';
    });

    // Load profile
    await loadProfile();

    // Setup actions
    document.getElementById('btnUpgradePlan').addEventListener('click', () => {
        alert('Función de actualización de plan próximamente.');
    });

    document.getElementById('btnExportData').addEventListener('click', async () => {
        try {
            const res = await fetch('/api/profile', { headers: authHeaders() });
            const data = await res.json();
            if (data.success) {
                const blob = new Blob([JSON.stringify(data.profile, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `polenai-profile-${Date.now()}.json`;
                a.click();
                URL.revokeObjectURL(url);
            }
        } catch (err) {
            console.error('Export error:', err);
            alert('Error al exportar datos');
        }
    });

    // Retry button
    const retryBtn = document.getElementById('retryBtn');
    if (retryBtn) {
        retryBtn.addEventListener('click', () => {
            showLoading();
            loadProfile();
        });
    }

    // Check admin status for nav
    await checkAdminStatus();
});

function showLoading() {
    if (profileCard) profileCard.style.display = 'none';
    if (errorState) errorState.style.display = 'none';
    document.getElementById('profileName').textContent = 'Cargando...';
    document.getElementById('profileEmail').textContent = '';
    document.getElementById('profilePlan').textContent = '';
    document.getElementById('profilePlan').className = 'plan-badge';
    // Reset stats
    ['statConversations', 'statMessages', 'statTokens', 'statRecent'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    ['infoEmail', 'infoName', 'infoPlan', 'infoCreated', 'infoLastActive'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '...';
    });
    if (errorState) errorState.style.display = 'none';
    if (profileCard) profileCard.style.display = 'block';
}

function showError(message) {
    if (profileCard) profileCard.style.display = 'none';
    if (errorState) {
        errorState.style.display = 'block';
        const errorMsg = errorState.querySelector('.error-message');
        if (errorMsg) errorMsg.textContent = message;
    }
    document.getElementById('profileName').textContent = 'Error al cargar';
}

function showProfile(p) {
    if (errorState) errorState.style.display = 'none';
    if (profileCard) profileCard.style.display = 'block';
    document.getElementById('profileName').textContent = p.display_name || p.email.split('@')[0];
    document.getElementById('profileEmail').textContent = p.email;
    document.getElementById('profilePlan').textContent = getPlanLabel(p.plan);
    document.getElementById('profilePlan').className = `plan-badge ${getPlanClass(p.plan)}`;

    // Stats
    document.getElementById('statConversations').textContent = formatNumber(p.conversations_total || 0);
    document.getElementById('statMessages').textContent = formatNumber(p.message_count || 0);
    document.getElementById('statTokens').textContent = formatNumber(p.token_count || 0);
    document.getElementById('statRecent').textContent = formatNumber(p.messages_last_7_days || 0);

    // Info
    document.getElementById('infoEmail').textContent = p.email;
    document.getElementById('infoName').textContent = p.display_name || '-';
    document.getElementById('infoPlan').textContent = getPlanLabel(p.plan);
    document.getElementById('infoCreated').textContent = formatDate(p.created_at);
    document.getElementById('infoLastActive').textContent = formatRelativeTime(p.last_active_at);
}

async function loadProfile() {
    showLoading();
    try {
        const res = await fetch('/api/profile', { headers: authHeaders() });
        if (res.status === 401) return forceLogout();

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al cargar perfil');

        const p = data.profile;
        showProfile(p);
    } catch (err) {
        console.error('Error loading profile:', err);
        showError(err.message || 'Error al cargar el perfil. Verifica tu conexión e inténtalo de nuevo.');
    }
}

async function checkAdminStatus() {
    const token = localStorage.getItem('polen_token');
    if (!token) return;

    try {
        const res = await fetch('/api/profile', {
            headers: { 'Authorization': 'Bearer ' + token }
        });
        if (res.ok) {
            const data = await res.json();
            if (data.success && data.profile.is_admin) {
                document.getElementById('navAdmin').style.display = 'flex';
            }
        }
    } catch (err) {
        console.error('Admin check failed:', err);
    }
}