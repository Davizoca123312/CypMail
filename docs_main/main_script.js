document.addEventListener('DOMContentLoaded', () => {
    const usernameSpan = document.getElementById('username');
    const emailList = document.getElementById('emailList');
    const refreshInboxButton = document.getElementById('refreshInbox');
    const composeEmailButton = document.getElementById('composeEmail');
    const logoutButton = document.getElementById('logoutButton');

    // Compose Modal Elements
    const composeModal = document.getElementById('composeModal');
    const closeModalButton = document.querySelector('.close-button');
    const composeForm = document.getElementById('composeForm');

    // --- Conexão WebSocket ---
    const socket = io();

    // Extrai o email do usuário da URL
    const pathParts = window.location.pathname.split('/');
    const userEmail = decodeURIComponent(pathParts.pop() || pathParts.pop()); 
    if (userEmail) {
        usernameSpan.textContent = userEmail.split('@')[0];
        // Registra o usuário no servidor WebSocket
        socket.emit('register_user', userEmail);
    }

    // Função para buscar e exibir emails via API REST
    const fetchEmails = async () => {
        try {
            // Passa o email do usuário como parâmetro de consulta
            const response = await fetch(`/api/inbox?user_email=${encodeURIComponent(userEmail)}`);
            if (response.ok) {
                const emails = await response.json();
                emailList.innerHTML = ''; // Limpa a lista atual
                if (emails.length === 0) {
                    emailList.innerHTML = '<p>Sua caixa de entrada está vazia.</p>';
                    return;
                }
                emails.forEach(email => {
                    const emailItem = document.createElement('div');
                    emailItem.classList.add('email-item');
                    
                    const header = document.createElement('div');
                    header.classList.add('email-header');
                    header.innerHTML = `
                        <strong>De:</strong> ${email.from}<br>
                        <strong>Assunto:</strong> ${email.subject}
                    `;

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
                emailList.innerHTML = '<p>Erro ao carregar e-mails.</p>';
            }
        } catch (error) {
            console.error('Erro ao buscar e-mails:', error);
            emailList.innerHTML = '<p>Erro de conexão ao carregar e-mails.</p>';
        }
    };

    // --- Event Listeners ---

    // Atualizar Caixa de Entrada
    refreshInboxButton.addEventListener('click', fetchEmails);

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
    composeForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const to = document.getElementById('composeTo').value;
        const subject = document.getElementById('composeSubject').value;
        const body = document.getElementById('composeBody').value;
        
        socket.emit('send_email', {
            to: to,
            subject: subject,
            body: body,
            from: userEmail // Email do usuário logado
        });
    });

    // Logout
    logoutButton.addEventListener('click', () => {
        window.location.href = '/';
    });

    // --- WebSocket Event Listeners ---

    // Lidar com a resposta do envio de email
    socket.on('send_email_response', (response) => {
        alert(response.message);
        if (response.status === 'success') {
            composeModal.style.display = 'none';
            composeForm.reset();
            fetchEmails(); // Atualiza a caixa de entrada
        }
    });

    // Lidar com a notificação de novo email
    socket.on('new_email', (data) => {
        console.log('Novo email recebido:', data);
        alert(`Novo email de: ${data.from}\nAssunto: ${data.subject}`);
        fetchEmails(); // Atualiza a caixa de entrada para mostrar o novo email
    });

    socket.on('connect', () => {
        console.log('Conectado ao servidor WebSocket.');
        // Re-registra o usuário em caso de reconexão
        if(userEmail) {
            socket.emit('register_user', userEmail);
        }
    });

    // Carregamento inicial
    fetchEmails();
});
