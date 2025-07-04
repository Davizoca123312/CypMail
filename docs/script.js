document.addEventListener('DOMContentLoaded', () => {
    const loginView = document.getElementById('login-view');
    const registerView = document.getElementById('register-view');
    const inboxContainer = document.getElementById('inbox-container');
    const composeEmailContainer = document.getElementById('compose-email-container');

    const showRegisterLink = document.getElementById('show-register');
    const showLoginLink = document.getElementById('show-login');

    const loginForm = document.getElementById('login-form');
    const registerForm = document.getElementById('register-form');
    const logoutBtn = document.getElementById('logout-btn');
    const composeBtn = document.getElementById('compose-btn');
    const cancelComposeBtn = document.getElementById('cancel-compose');
    const composeForm = document.getElementById('compose-form');

    const userEmailSpan = document.getElementById('user-email');
    const emailListDiv = document.getElementById('email-list');

    let currentUserEmail = '';
    let inboxInterval;
    const socket = io();

    // Função para extrair o email do usuário da URL
    function getEmailFromUrl() {
        const path = window.location.pathname;
        const match = path.match(/\/user\/(.+)/);
        if (match && match[1]) {
            return decodeURIComponent(match[1]);
        }
        return '';
    }

    // Verifica se já estamos em uma sessão (via URL)
    currentUserEmail = getEmailFromUrl();
    if (currentUserEmail) {
        userEmailSpan.textContent = currentUserEmail;
        document.querySelector('.form-container').classList.add('hidden');
        inboxContainer.classList.remove('hidden');
        loadEmails();
        inboxInterval = setInterval(loadEmails, 2000);
    }

    // Alternar para a tela de cadastro
    showRegisterLink.addEventListener('click', (e) => {
        e.preventDefault();
        loginView.classList.add('hidden');
        registerView.classList.remove('hidden');
    });

    // Alternar para a tela de login
    showLoginLink.addEventListener('click', (e) => {
        e.preventDefault();
        registerView.classList.add('hidden');
        loginView.classList.remove('hidden');
    });

    // Lidar com o envio do formulário de cadastro
    registerForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(registerForm);
        const response = await fetch('/register', {
            method: 'POST',
            body: new URLSearchParams(formData)
        });
        const result = await response.text();
        alert(result);
        if (response.ok) {
            showLoginLink.click(); // Volta para a tela de login
        }
    });

    // Lidar com o envio do formulário de login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        const response = await fetch('/login', {
            method: 'POST',
            body: new URLSearchParams(formData)
        });

        if (response.ok) {
            const email = formData.get('email');
            window.location.href = `/user/${encodeURIComponent(email)}`; // Redireciona para a nova rota
        } else {
            const error = await response.text();
            alert(error);
        }
    });

    // Lidar com o logout
    logoutBtn.addEventListener('click', () => {
        clearInterval(inboxInterval); // Para a atualização automática
        window.location.href = '/'; // Volta para a página inicial de login
    });

    // Botão de Compor Email
    composeBtn.addEventListener('click', () => {
        inboxContainer.classList.add('hidden');
        composeEmailContainer.classList.remove('hidden');
    });

    // Botão de Cancelar Composição
    cancelComposeBtn.addEventListener('click', () => {
        composeEmailContainer.classList.add('hidden');
        inboxContainer.classList.remove('hidden');
        composeForm.reset(); // Limpa o formulário
    });

    // Lidar com o envio do formulário de composição
    composeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const to = document.getElementById('to').value;
        const subject = document.getElementById('subject').value;
        const body = document.getElementById('body').value;

        socket.emit('send_email', {
            to,
            subject,
            body,
            from: currentUserEmail
        });
    });

    socket.on('send_email_response', (response) => {
        alert(response.message);
        if (response.status === 'success') {
            composeEmailContainer.classList.add('hidden');
            inboxContainer.classList.remove('hidden');
            composeForm.reset();
            loadEmails();
        }
    });

    // Carrega emails da API
    async function loadEmails() {
        if (!currentUserEmail) return; // Não carrega emails se não houver usuário logado
        try {
            const response = await fetch('/api/inbox');
            if (response.ok) {
                const emails = await response.json();
                emailListDiv.innerHTML = ''; // Limpa a lista atual
                if (emails.length === 0) {
                    emailListDiv.innerHTML = '<p>Nenhum email na caixa de entrada.</p>';
                } else {
                    emails.forEach(email => {
                        const emailItem = document.createElement('div');
                        emailItem.classList.add('email-item');
                        emailItem.innerHTML = `
                            <div><strong>De:</strong> ${email.from}</div>
                            <div><strong>Assunto:</strong> ${email.subject}</div>
                        `;
                        emailListDiv.appendChild(emailItem);
                    });
                }
            } else {
                console.error('Erro ao carregar emails:', response.statusText);
                emailListDiv.innerHTML = '<p>Erro ao carregar emails.</p>';
            }
        } catch (error) {
            console.error('Erro de rede ao carregar emails:', error);
            emailListDiv.innerHTML = '<p>Erro de rede ao carregar emails.</p>';
        }
    }
});