
// Chat logic - handles messages, sidebar, streaming with premium UX
let currentConvId = null;
let conversations = [];
let isStreaming = false;

document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('polen_user');
    if (!user) {
        window.location.href = '/';
        return;
    }

    const token = localStorage.getItem('polen_token');
    if (!token) {
        window.location.href = '/';
        return;
    }

    loadConversations();
    setupChat();
    setupLogout();
    setupSuggestionChips();
    setupNewChat();
});

function setupLogout() {
    document.getElementById('logoutBtn').addEventListener('click', () => {
        if (confirm('¿Estás seguro de cerrar sesión?')) {
            localStorage.removeItem('polen_token');
            localStorage.removeItem('polen_user');
            window.location.href = '/';
        }
    });
}

function setupNewChat() {
    document.getElementById('newChatBtn').addEventListener('click', () => {
        currentConvId = null;
        document.getElementById('currentTitle').textContent = 'Nueva conversación';
        document.getElementById('messagesContainer').innerHTML = `
            <div class="welcome-message">
                <div class="welcome-icon">🐝</div>
                <h3>Hola, soy PolenAI</h3>
                <p>¿En qué puedo ayudarte hoy?</p>
                <div class="suggestion-chips">
                    <button class="chip" data-prompt="Explica de forma sencilla qué es una inteligencia artificial">¿Qué es la IA?</button>
                    <button class="chip" data-prompt="Ayúdame a escribir un email formal">Email formal</button>
                    <button class="chip" data-prompt="Dame 5 ideas de proyectos de programación">Proyectos</button>
                </div>
            </div>
        `;
        renderSidebar();
    });
}

function setupSuggestionChips() {
    document.querySelectorAll('.chip').forEach(chip => {
        chip.addEventListener('click', () => {
            document.getElementById('messageInput').value = chip.dataset.prompt;
            document.getElementById('chatForm').dispatchEvent(new Event('submit'));
        });
    });
}

async function loadConversations() {
    try {
        const res = await fetch('/api/conversations', {
            headers: {'Authorization': 'Bearer ' + localStorage.getItem('polen_token')}
        });
        const data = await res.json();
        if (data.success) {
            conversations = data.conversations || [];
            renderSidebar();
        }
    } catch (err) {
        console.error('Error loading conversations:', err);
    }
}

function renderSidebar() {
    const list = document.getElementById('conversationsList');
    list.innerHTML = '';
    
    conversations.forEach(conv => {
        const item = document.createElement('div');
        item.className = 'conversation-item' + (conv.id === currentConvId ? ' active' : '');
        
        const date = new Date(conv.updated_at).toLocaleDateString('es-ES', {
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
        
        item.innerHTML = `
            <span class="conv-title">${escapeHtml(conv.title)}</span>
            <span class="conv-date">${date}</span>
        `;
        
        item.addEventListener('click', () => loadConversation(conv.id));
        list.appendChild(item);
    });
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadConversation(convId) {
    currentConvId = convId;
    const conv = conversations.find(c => c.id === convId);
    if (!conv) return;

    document.getElementById('currentTitle').textContent = conv.title;
    renderSidebar();

    const container = document.getElementById('messagesContainer');
    container.innerHTML = '';
    
    conv.messages.forEach(msg => {
        addMessage(msg.role, msg.content);
    });
}

function setupChat() {
    const form = document.getElementById('chatForm');
    const input = document.getElementById('messageInput');
    const sendBtn = document.getElementById('sendBtn');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const message = input.value.trim();
        if (!message || isStreaming) return;

        input.value = '';
        addMessage('user', message);
        isStreaming = true;
        sendBtn.disabled = true;

        const assistantMsg = addMessage('assistant', '');
        const contentEl = assistantMsg.querySelector('.message-content');
        let fullText = '';

        try {
            const token = localStorage.getItem('polen_token');
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + token
                },
                body: JSON.stringify({
                    conversationId: currentConvId,
                    message: message
                })
            });

            if (!res.ok) {
                const errData = await res.json();
                contentEl.textContent = errData.error || 'Error';
                isStreaming = false;
                sendBtn.disabled = false;
                return;
            }

            // Read streaming response
            const reader = res.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        const data = line.slice(6);
                        if (data === '[DONE]') break;
                        try {
                            const parsed = JSON.parse(data);
                            if (parsed.content) {
                                fullText += parsed.content;
                                contentEl.textContent = fullText;
                                scrollToBottom();
                            }
                            if (parsed.conversationId && !currentConvId) {
                                currentConvId = parsed.conversationId;
                                loadConversations();
                            }
                        } catch (e) { /* skip non-JSON lines */ }
                    }
                }
            }
        } catch (err) {
            contentEl.textContent = 'Error de conexión: ' + err.message;
        } finally {
            isStreaming = false;
            sendBtn.disabled = false;
            input.focus();
        }
    });
}

function addMessage(role, content) {
    const container = document.getElementById('messagesContainer');
    const wrapper = document.createElement('div');
    wrapper.className = 'message-wrapper ' + role;
    
    const avatar = document.createElement('div');
    avatar.className = 'avatar ' + role;
    avatar.textContent = role === 'user' ? 'U' : '🐝';
    
    const msg = document.createElement('div');
    msg.className = 'message';
    
    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';
    contentDiv.textContent = content;
    
    msg.appendChild(contentDiv);
    wrapper.appendChild(avatar);
    wrapper.appendChild(msg);
    container.appendChild(wrapper);
    scrollToBottom();
    
    return wrapper;
}

function scrollToBottom() {
    const container = document.getElementById('messagesContainer');
    setTimeout(() => {
        container.scrollTop = container.scrollHeight;
    }, 100);
}
