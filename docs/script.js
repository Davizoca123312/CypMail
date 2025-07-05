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

    const languageToggleButton = document.getElementById('language-toggle-button');
    const languageOptionsDiv = document.getElementById('language-options');
    const langOptionButtons = document.querySelectorAll('.lang-option');

    let translations = {};

    // Function to load translations
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`/languages/${lang}.json`);
            translations = await response.json();
            applyTranslations();
            localStorage.setItem('selectedLanguage', lang);
        } catch (error) {
            console.error('Error loading translations:', error);
        }
    }

    // Function to apply translations
    function applyTranslations() {
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            if (translations[key]) {
                element.textContent = translations[key];
            }
        });
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            if (translations[key]) {
                element.placeholder = translations[key];
            }
        });
    }

    // Set initial language
    const initialLang = localStorage.getItem('selectedLanguage') || 'pt';
    loadTranslations(initialLang);

    // Language toggle button event
    languageToggleButton.addEventListener('click', () => {
        languageOptionsDiv.classList.toggle('hidden');
    });

    // Language option buttons event
    langOptionButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const lang = event.target.dataset.lang;
            loadTranslations(lang);
            languageOptionsDiv.classList.add('hidden'); // Hide options after selection
        });
    });

    // Hide language options if clicked outside
    window.addEventListener('click', (event) => {
        if (!languageOptionsDiv.contains(event.target) && !languageToggleButton.contains(event.target)) {
            languageOptionsDiv.classList.add('hidden');
        }
    });

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
        const password = formData.get('password');
        const confirmPassword = formData.get('confirm_password');
        const email = formData.get('email');

        if (!email || !password || !confirmPassword) {
            alert(translations.fill_all_fields);
            return;
        }

        if (password !== confirmPassword) {
            alert(translations.passwords_do_not_match);
            return;
        }

        if (!email.endsWith("@cypmail.com")) {
            alert(translations.email_must_be_cypmail);
            return;
        }

        if (password.length < 8) {
            alert(translations.password_min_length);
            return;
        }

        try {
            const response = await fetch('/register', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });
            const result = await response.text();
            if (response.ok) {
                alert(translations.registration_success);
                showLoginLink.click(); // Volta para a tela de login
            } else {
                alert(`${translations.registration_error_prefix} ${result}`);
            }
        } catch (error) {
            console.error('Registration connection error:', error);
            alert(translations.connection_error);
        }
    });

    // Lidar com o envio do formulário de login
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const formData = new FormData(loginForm);
        try {
            const response = await fetch('/login', {
                method: 'POST',
                body: new URLSearchParams(formData)
            });

            if (response.ok) {
                const email = formData.get('email');
                window.location.href = `/user/${encodeURIComponent(email)}`; // Redireciona para a nova rota
            } else {
                const error = await response.text();
                alert(`${translations.login_error_prefix} ${error}`);
            }
        } catch (error) {
            console.error('Login connection error:', error);
            alert(translations.connection_error);
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
        const to = document.getElementById('compose-to').value;
        const subject = document.getElementById('compose-subject').value;
        const body = document.getElementById('compose-body').value;

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
                    emailListDiv.innerHTML = `<p>${translations.inbox_empty}</p>`;
                } else {
                    emails.forEach(email => {
                        const emailItem = document.createElement('div');
                        emailItem.classList.add('email-item');
                        emailItem.innerHTML = `
                            <div><strong>${translations.from_prefix}</strong> ${email.from}</div>
                            <div><strong>${translations.subject_prefix}</strong> ${email.subject}</div>
                        `;
                        emailListDiv.appendChild(emailItem);
                    });
                }
            } else {
                console.error('Erro ao carregar emails:', response.statusText);
                emailListDiv.innerHTML = `<p>${translations.error_loading_emails}</p>`;
            }
        } catch (error) {
            console.error('Erro de rede ao carregar emails:', error);
            emailListDiv.innerHTML = `<p>${translations.connection_error_loading_emails}</p>`;
        }
    }
});