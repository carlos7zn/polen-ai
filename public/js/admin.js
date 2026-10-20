// Admin panel logic
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

function getPlanBadge(plan) {
    const labels = { 'free': 'Gratuito', 'pro': 'Pro', 'premium': 'Premium' };
    const cls = { 'free': 'plan-free', 'pro': 'plan-pro', 'premium': 'plan-premium' };
    return `<span class="plan-badge ${cls[plan] || 'plan-free'}">${labels[plan] || plan}</span>`;
}

let allUsers = [];
let currentPage = 1;
const pageSize = 20;

document.addEventListener('DOMContentLoaded', async () => {
    const token = localStorage.getItem('polen_token');
    const user = localStorage.getItem('polen_user');

    if (!token || !user) {
        window.location.href = '/';
        return;
    }

    // Verify admin
    try {
        const res = await fetch('/api/profile', { headers: authHeaders() });
        if (res.status === 401) return forceLogout();
        const data = await res.json();
        if (!data.success || !data.profile.is_admin) {
            alert('Acceso denegado: solo administradores');
            window.location.href = '/chat.html';
            return;
        }
    } catch (err) {
        console.error('Auth check error:', err);
        window.location.href = '/chat.html';
        return;
    }

    // Setup back to chat
    document.querySelector('.sidebar-footer a').addEventListener('click', (e) => {
        e.preventDefault();
        window.location.href = '/chat.html';
    });

    // Load admin data
    await loadAdminUsers();

    // Pagination
    document.getElementById('prevPage').addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderUsersTable();
        }
    });

    document.getElementById('nextPage').addEventListener('click', () => {
        if (currentPage < Math.ceil(allUsers.length / pageSize)) {
            currentPage++;
            renderUsersTable();
        }
    });
});

async function loadAdminUsers() {
    try {
        const res = await fetch('/api/admin/users', { headers: authHeaders() });
        if (res.status === 401) return forceLogout();
        if (res.status === 403) {
            alert('Acceso denegado: solo administradores');
            window.location.href = '/chat.html';
            return;
        }

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Error al cargar usuarios');

        allUsers = data.users || [];
        renderAdminStats();
        renderUsersTable();
    } catch (err) {
        console.error('Error loading admin users:', err);
        document.getElementById('adminUsersBody').innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px;">Error al cargar usuarios</td></tr>';
    }
}

function renderAdminStats() {
    const totalUsers = allUsers.length;
    const totalConversations = allUsers.reduce((sum, u) => sum + (u.conversations_total || 0), 0);
    const totalMessages = allUsers.reduce((sum, u) => sum + (u.message_count || 0), 0);
    const activeWeek = allUsers.filter(u => (u.messages_last_7_days || 0) > 0).length;

    document.getElementById('adminTotalUsers').textContent = formatNumber(totalUsers);
    document.getElementById('adminTotalConversations').textContent = formatNumber(totalConversations);
    document.getElementById('adminTotalMessages').textContent = formatNumber(totalMessages);
    document.getElementById('adminActiveWeek').textContent = formatNumber(activeWeek);
}

function renderUsersTable() {
    const tbody = document.getElementById('adminUsersBody');
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const pageUsers = allUsers.slice(start, end);

    if (pageUsers.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;color:var(--text-muted);padding:40px;">No hay usuarios</td></tr>';
        updatePagination();
        return;
    }

    tbody.innerHTML = pageUsers.map(u => `
        <tr>
            <td>
                <div style="display:flex;align-items:center;gap:8px;">
                    <span style="width:28px;height:28px;border-radius:50%;background:var(--bg-tertiary);border:1px solid var(--border-subtle);display:flex;align-items:center;justify-content:center;font-size:12px;color:var(--text-secondary);">🐝</span>
                    <span style="font-weight:500;">${u.display_name || u.email.split('@')[0]}</span>
                </div>
            </td>
            <td>${u.email}</td>
            <td>${getPlanBadge(u.plan)}</td>
            <td>${formatNumber(u.conversations_total || 0)}</td>
            <td>${formatNumber(u.message_count || 0)}</td>
            <td>${formatNumber(u.messages_last_7_days || 0)}</td>
            <td>${formatRelativeTime(u.last_active_at)}</td>
            <td>${formatDate(u.created_at)}</td>
            <td>${u.is_admin ? '<span style="color:var(--accent);font-weight:600;">Sí</span>' : '<span style="color:var(--text-muted);">No</span>'}</td>
        </tr>
    `).join('');

    updatePagination();
}

function updatePagination() {
    const totalPages = Math.ceil(allUsers.length / pageSize);
    const pagination = document.getElementById('pagination');
    const pageInfo = document.getElementById('pageInfo');
    const prevBtn = document.getElementById('prevPage');
    const nextBtn = document.getElementById('nextPage');

    if (totalPages <= 1) {
        pagination.style.display = 'none';
        return;
    }

    pagination.style.display = 'flex';
    pageInfo.textContent = `Página ${currentPage} de ${totalPages}`;
    prevBtn.disabled = currentPage === 1;
    nextBtn.disabled = currentPage === totalPages;
}

// Utility functions (defined once at top, but re-declared here for hoisting safety)
// These are the same functions declared at the top of the file
// formatNumber, formatDate, formatRelativeTime, getPlanBadge are already defined above
// This comment ensures no duplicate declarations