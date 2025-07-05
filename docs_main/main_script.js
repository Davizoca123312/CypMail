document.addEventListener('DOMContentLoaded', () => {
    const usernameSpan = document.getElementById('username');
    const emailList = document.getElementById('emailList');
    const tabs = document.querySelectorAll('.tab-item');

    let currentTab = 'inbox'; // Default tab

    // --- Tab Switching Logic ---
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(item => item.classList.remove('active'));
            tab.classList.add('active');
            currentTab = tab.id.replace('Tab', ''); // e.g., 'inboxTab' -> 'inbox'
            fetchEmails(currentTab);
        });
    });
    const refreshInboxButton = document.getElementById('refreshInbox');
    const composeEmailButton = document.getElementById('composeEmail');
    const logoutButton = document.getElementById('logoutButton');
    const themeToggleButton = document.getElementById('themeToggleButton');
    const profilePicInput = document.getElementById('profilePicUpload');
    const uploadProfilePicButton = document.getElementById('uploadProfilePicButton');
    const profilePicDisplay = document.getElementById('profilePic');
    const changeProfilePicButton = document.getElementById('changeProfilePicButton');
    const profilePicModal = document.getElementById('profilePicModal');
    const closeProfilePicModalButton = document.getElementById('closeProfilePicModal');

    // Compose Modal Elements
    const composeModal = document.getElementById('composeModal');
    const closeModalButton = document.querySelector('.close-button');
    const composeForm = document.getElementById('composeForm');
    const composeToInput = document.getElementById('composeTo');
    const recipientStatusSpan = document.getElementById('recipientStatus');

    const languageToggleButton = document.getElementById('language-toggle-button');
    const languageOptionsDiv = document.getElementById('language-options');
    const langOptionButtons = document.querySelectorAll('.lang-option');

    let translations = {};

    // Function to load translations
    async function loadTranslations(lang) {
        try {
            const response = await fetch(`/docs_main/languages/${lang}.json`);
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
        // Update specific elements not covered by data-i18n
        if (usernameSpan.textContent) {
            usernameSpan.textContent = usernameSpan.textContent; // Keep username as is
        }
        // Update tab texts
        document.getElementById('inboxTab').textContent = translations.tab_inbox;
        document.getElementById('starredTab').textContent = translations.tab_starred;
        document.getElementById('postponedTab').textContent = translations.tab_postponed;
        document.getElementById('sentTab').textContent = translations.tab_sent;
        document.getElementById('draftsTab').textContent = translations.tab_drafts;
        document.getElementById('importantTab').textContent = translations.tab_important;
        document.getElementById('chatsTab').textContent = translations.tab_chats;
        document.getElementById('scheduledTab').textContent = translations.tab_scheduled;
        document.getElementById('allMailTab').textContent = translations.tab_all_mail;
        document.getElementById('spamTab').textContent = translations.tab_spam;
        document.getElementById('trashTab').textContent = translations.tab_trash;

        // Update welcome message separately as it has a dynamic part
        document.querySelector('h1').innerHTML = `${translations.welcome_message_prefix} <span id="username">${usernameSpan.textContent}</span>!`;
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

    // --- Conexão WebSocket ---
    const socket = io();

    // Extrai o email do usuário da URL
    const pathParts = window.location.pathname.split('/');
    const userEmail = decodeURIComponent(pathParts.pop() || pathParts.pop()); 
    if (userEmail) {
        usernameSpan.textContent = userEmail.split('@')[0];
        // Registra o usuário no servidor WebSocket
        socket.emit('register_user', userEmail);

        // Função para carregar a foto de perfil
        const loadProfilePic = () => {
            const picFilename = userEmail.split('@')[0] + '.png';
            profilePicDisplay.src = `/profile_pics/${picFilename}`;
            profilePicDisplay.onerror = () => {
                profilePicDisplay.src = 'https://via.placeholder.com/150'; // Imagem padrão se não houver foto
            };
        };

        // Event listener para o upload da foto de perfil
        uploadProfilePicButton.addEventListener('click', async () => {
            const file = profilePicInput.files[0];
            if (!file) {
                alert(translations.select_file_for_upload);
                return;
            }

            const formData = new FormData();
            formData.append('file', file);
            formData.append('user_email', userEmail);

            try {
                const response = await fetch('/upload_profile_pic', {
                    method: 'POST',
                    body: formData,
                });
                if (response.ok) {
                    alert(translations.profile_pic_upload_success);
                    loadProfilePic(); // Recarrega a imagem após o upload
                    profilePicModal.style.display = 'none'; // Fecha o modal após o upload
                } else {
                    alert(translations.profile_pic_upload_error);
                }
            } catch (error) {
                console.error('Erro ao enviar foto de perfil:', error);
                alert(translations.profile_pic_connection_error);
            }
        });

        loadProfilePic(); // Carrega a foto de perfil ao iniciar
    }

    // --- Lógica de Tema Claro/Escuro ---
    const currentTheme = localStorage.getItem('theme');
    if (currentTheme) {
        document.body.classList.add(currentTheme);
    } else {
        document.body.classList.add('light-mode'); // Tema padrão
    }

    themeToggleButton.addEventListener('click', () => {
        if (document.body.classList.contains('light-mode')) {
            document.body.classList.remove('light-mode');
            document.body.classList.add('dark-mode');
            localStorage.setItem('theme', 'dark-mode');
        } else {
            document.body.classList.remove('dark-mode');
            document.body.classList.add('light-mode');
            localStorage.setItem('theme', 'light-mode');
        }
    });

    // --- Lógica do Modal de Foto de Perfil ---
    changeProfilePicButton.addEventListener('click', () => {
        profilePicModal.style.display = 'block';
    });

    closeProfilePicModalButton.addEventListener('click', () => {
        profilePicModal.style.display = 'none';
    });

    // Fechar modal se o usuário clicar fora dele
    window.addEventListener('click', (event) => {
        if (event.target == profilePicModal) {
            profilePicModal.style.display = 'none';
        }
    });

    // Event listener para o upload da foto de perfil (agora dentro do modal)
    uploadProfilePicButton.addEventListener('click', async () => {
        const file = profilePicInput.files[0];
        if (!file) {
            alert(translations.select_file_for_upload);
            return;
        }

        const formData = new FormData();
        formData.append('file', file);
        formData.append('user_email', userEmail);

        try {
            const response = await fetch('/upload_profile_pic', {
                method: 'POST',
                body: formData,
            });
            if (response.ok) {
                alert(translations.profile_pic_upload_success);
                loadProfilePic(); // Recarrega a imagem após o upload
                profilePicModal.style.display = 'none'; // Fecha o modal após o upload
            } else {
                alert(translations.profile_pic_upload_error);
            }
        } catch (error) {
            console.error('Erro ao enviar foto de perfil:', error);
            alert(translations.profile_pic_connection_error);
        }
    });

    // Função para buscar e exibir emails via API REST
    const fetchEmails = async (tabType = 'inbox') => {
        try {
            // Passa o email do usuário e o tipo de aba como parâmetro de consulta
            const response = await fetch(`/api/emails?user_email=${encodeURIComponent(userEmail)}&tab=${tabType}`);
            if (response.ok) {
                const emails = await response.json();
                emailList.innerHTML = ''; // Limpa a lista atual
                if (emails.length === 0) {
                    emailList.innerHTML = `<p>${translations.inbox_empty}</p>`;
                    return;
                }
                emails.forEach(email => {
                    const emailItem = document.createElement('div');
                    emailItem.classList.add('email-item');
                    emailItem.dataset.emailId = email.id; // Adiciona um ID único ao item do email
                    
                    const header = document.createElement('div');
                    header.classList.add('email-header');

                    const senderInfo = document.createElement('div');
                    senderInfo.classList.add('sender-info');

                    const senderPic = document.createElement('img');
                    senderPic.classList.add('sender-profile-pic');
                    senderPic.src = email.sender_profile_pic;
                    senderPic.alt = 'Foto de Perfil';

                    const senderText = document.createElement('div');
                    senderText.innerHTML = `
                        <strong>${translations.from_prefix}</strong> ${email.from_display}<br>
                        <strong>${translations.subject_prefix}</strong> ${email.subject}
                    `;

                    senderInfo.appendChild(senderPic);
                    senderInfo.appendChild(senderText);
                    header.appendChild(senderInfo);

                    const deleteButton = document.createElement('button');
                    deleteButton.classList.add('delete-email-button');
                    deleteButton.textContent = translations.delete_button;
                    deleteButton.addEventListener('click', async (e) => {
                        e.stopPropagation(); // Impede que o clique no botão expanda/recolha o email
                        if (confirm(translations.confirm_delete_email)) {
                            try {
                                const response = await fetch(`/delete_email/${email.id}`, {
                                    method: 'DELETE',
                                });
                                if (response.ok) {
                                    alert(translations.email_deleted_success);
                                    fetchEmails(); // Atualiza a caixa de entrada
                                } else {
                                    alert(translations.email_delete_error);
                                }
                            } catch (error) {
                                console.error('Erro ao excluir email:', error);
                                alert(translations.email_delete_connection_error);
                            }
                        }
                    });

                    header.appendChild(deleteButton);

                    const body = document.createElement('div');
                    body.classList.add('email-body');
                    body.innerHTML = `<pre>${email.body}</pre>`; // Usa <pre> para manter a formatação
                    body.style.display = 'none'; // Oculta o corpo por padrão

                    emailItem.appendChild(header);
                    emailItem.appendChild(body);

                    // Adiciona evento de clique para expandir/recolher
                    header.addEventListener('click', () => {
                        body.style.display = body.style.display === 'none' ? 'block' : 'none';
                    });

                    emailList.appendChild(emailItem);
                });
            } else {
                emailList.innerHTML = `<p>${translations.error_loading_emails}</p>`;
            }
        } catch (error) {
            console.error('Erro ao buscar e-mails:', error);
            emailList.innerHTML = `<p>${translations.connection_error_loading_emails}</p>`;
        }
    };

    // --- Event Listeners ---

    // Atualizar Caixa de Entrada
    refreshInboxButton.addEventListener('click', () => fetchEmails(currentTab));

    // Abrir Modal de Composição
    composeEmailButton.addEventListener('click', () => {
        composeModal.style.display = 'block';
    });

    // Fechar Modal de Composição
    closeModalButton.addEventListener('click', () => {
        composeModal.style.display = 'none';
    });

    // Fechar modal se o usuário clicar fora dele
    window.addEventListener('click', (event) => {
        if (event.target == composeModal) {
            composeModal.style.display = 'none';
        }
    });

    // Lidar com o Envio do Formulário de Composição via WebSocket
    composeForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const to = composeToInput.value;
        const subject = document.getElementById('composeSubject').value;
        const body = document.getElementById('composeBody').value;

        // Validação final antes de enviar
        if (!to.endsWith("@cypmail.com")) {
            recipientStatusSpan.textContent = translations.email_must_be_cypmail;
            recipientStatusSpan.style.color = 'red';
            return;
        }

        const response = await fetch(`/check_user_exists/${encodeURIComponent(to)}`);
        const data = await response.json();

        if (!data.exists) {
            recipientStatusSpan.textContent = translations.user_does_not_exist;
            recipientStatusSpan.style.color = 'red';
            return;
        }
        
        socket.emit('send_email', {
            to: to,
            subject: subject,
            body: body,
            from: userEmail // Email do usuário logado
        });
    });

    // Validação em tempo real do destinatário
    let typingTimer;
    const doneTypingInterval = 500; // ms

    composeToInput.addEventListener('input', () => {
        clearTimeout(typingTimer);
        const email = composeToInput.value;
        if (email.length > 0) {
            typingTimer = setTimeout(async () => {
                if (email.endsWith("@cypmail.com")) {
                    const response = await fetch(`/check_user_exists/${encodeURIComponent(email)}`);
                    const data = await response.json();
                    if (data.exists) {
                        recipientStatusSpan.textContent = translations.user_exists;
                        recipientStatusSpan.style.color = 'green';
                    } else {
                        recipientStatusSpan.textContent = translations.user_does_not_exist;
                        recipientStatusSpan.style.color = 'red';
                    }
                } else {
                    recipientStatusSpan.textContent = translations.email_must_be_cypmail;
                    recipientStatusSpan.style.color = 'orange';
                }
            }, doneTypingInterval);
        } else {
            recipientStatusSpan.textContent = '';
        }
    });

    // Logout
    logoutButton.addEventListener('click', () => {
        window.location.href = '/';
    });

    // --- WebSocket Event Listeners ---

    // Lidar com a resposta do envio de email
    socket.on('send_email_response', (response) => {
        alert(response.message); // Keep alert for now, can be replaced by a toast notification
        if (response.status === 'success') {
            composeModal.style.display = 'none';
            composeForm.reset();
            fetchEmails(currentTab); // Atualiza a caixa de entrada
        }
    });

    // Lidar com a notificação de novo email
    socket.on('new_email', (data) => {
        console.log('Novo email recebido:', data);
        // alert(`Novo email de: ${data.from}\nAssunto: ${data.subject}`); // Removido o popup
        fetchEmails(currentTab); // Atualiza a caixa de entrada para mostrar o novo email
    });

    socket.on('connect', () => {
        console.log('Conectado ao servidor WebSocket.');
        // Re-registra o usuário em caso de reconexão
        if(userEmail) {
            socket.emit('register_user', userEmail);
        }
    });

    // Carregamento inicial
    fetchEmails(currentTab);
});