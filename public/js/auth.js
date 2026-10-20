
// Auth logic - handles login/register forms with premium UX
document.addEventListener('DOMContentLoaded', () => {
    const tabs = document.querySelectorAll('.tab-btn');
    const forms = document.querySelectorAll('.auth-form');
    
    // Tab switching with animation
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            const targetTab = tab.dataset.tab;
            tabs.forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            forms.forEach(f => f.classList.remove('active'));
            document.getElementById(targetTab + 'Form').classList.add('active');
        });
    });

    // Login form
    document.getElementById('loginForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('loginEmail').value;
        const password = document.getElementById('loginPassword').value;
        const errorEl = document.getElementById('loginError');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Reset error
        errorEl.style.display = 'none';
        
        // Show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> Iniciando sesión...';
        
        try {
            const res = await fetch('/api/login', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password})
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('polen_token', data.token);
                localStorage.setItem('polen_user', JSON.stringify(data.user));
                window.location.href = '/chat.html';
            } else {
                errorEl.textContent = data.error || 'Error al iniciar sesión';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexión';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Iniciar Sesión';
        }
    });

    // Register form
    document.getElementById('registerForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('registerEmail').value;
        const password = document.getElementById('registerPassword').value;
        const name = document.getElementById('registerName').value;
        const errorEl = document.getElementById('registerError');
        const submitBtn = e.target.querySelector('button[type="submit"]');
        
        // Reset error
        errorEl.style.display = 'none';
        
        // Validation
        if (password.length < 6) {
            errorEl.textContent = 'La contraseña debe tener al menos 6 caracteres';
            errorEl.style.display = 'block';
            return;
        }
        
        // Show loading
        submitBtn.disabled = true;
        submitBtn.innerHTML = '<span class="loading"></span> Registrando...';
        
        try {
            const res = await fetch('/api/register', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({email, password, display_name: name})
            });
            const data = await res.json();
            
            if (data.success) {
                localStorage.setItem('polen_token', data.token);
                localStorage.setItem('polen_user', JSON.stringify(data.user));
                window.location.href = '/chat.html';
            } else {
                errorEl.textContent = data.error || 'Error al registrarse';
                errorEl.style.display = 'block';
            }
        } catch (err) {
            errorEl.textContent = 'Error de conexión';
            errorEl.style.display = 'block';
        } finally {
            submitBtn.disabled = false;
            submitBtn.innerHTML = 'Registrarse';
        }
    });

    // Add smooth transitions
    document.querySelectorAll('input').forEach(input => {
        input.addEventListener('focus', () => {
            input.parentElement.style.transform = 'translateY(-2px)';
        });
        input.addEventListener('blur', () => {
            input.parentElement.style.transform = 'translateY(0)';
        });
    });
});
