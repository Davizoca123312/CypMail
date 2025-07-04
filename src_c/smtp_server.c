#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <time.h>
#include "winsock_utils.h"

#ifdef _WIN32
#include <ws2tcpip.h>
#include <windows.h> // For CreateDirectoryA
#define MKDIR(path) CreateDirectoryA(path, NULL)
#define STRNICMP _strnicmp
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <sys/stat.h> // For mkdir
#define MKDIR(path) mkdir(path, 0777)
#define STRNICMP strncasecmp
#endif

#define SMTP_PORT 2525
#define BUFFER_SIZE 2048
#define MAX_CLIENTS 5

// Estados da sessão SMTP
enum SmtpState {
    STATE_INIT,
    STATE_HELO,
    STATE_MAIL_FROM,
    STATE_RCPT_TO,
    STATE_DATA,
    STATE_QUIT
};

// Função para gerar um ID de mensagem único
void generate_message_id(char* buffer, size_t len) {
    time_t timer;
    struct tm* tm_info;
    time(&timer);
    tm_info = localtime(&timer);
    strftime(buffer, len, "%Y%m%d%H%M%S", tm_info);
    // Adiciona um número aleatório para maior unicidade
    snprintf(buffer + strlen(buffer), len - strlen(buffer), "-%d", rand() % 10000);
}

// Função para salvar o email
void save_email(const char* recipient, const char* data) {
    char user_mailbox_path[256];
    char filename[256];
    char msg_id[64];

    // Extrai o nome de usuário do email (tudo antes do @)
    char username[128];
    strncpy(username, recipient, sizeof(username) - 1);
    username[sizeof(username) - 1] = '\0';
    char* at_sign = strchr(username, '@');
    if (at_sign) {
        *at_sign = '\0';
    }

    // Cria o caminho completo para a caixa de correio do usuário
    snprintf(user_mailbox_path, sizeof(user_mailbox_path), "mailboxes/%s", username);

    // Tenta criar o diretório da caixa de correio se não existir
    MKDIR(user_mailbox_path);

    generate_message_id(msg_id, sizeof(msg_id));
    snprintf(filename, sizeof(filename), "%s/%s.eml", user_mailbox_path, msg_id);

    FILE* fp = fopen(filename, "w");
    if (fp) {
        fprintf(fp, "%s", data);
        fclose(fp);
        printf("Email salvo para %s em %s\n", recipient, filename);
    } else {
        perror("Erro ao salvar email");
    }
}

// Função principal do servidor SMTP
int start_smtp_server() {
    initialize_winsock();
    int server_fd, new_socket;
    struct sockaddr_in address;
    int addrlen = sizeof(address);

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(SMTP_PORT);

    bind(server_fd, (struct sockaddr *)&address, sizeof(address));
    listen(server_fd, MAX_CLIENTS);

    printf("Servidor SMTP escutando na porta %d\n", SMTP_PORT);

    while ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) >= 0) {
        printf("Nova conexão SMTP aceita\n");
        enum SmtpState state = STATE_INIT;
        char buffer[BUFFER_SIZE];
        char mail_from[256] = {0};
        char rcpt_to[256] = {0};
        char email_data[BUFFER_SIZE * 4] = {0}; // Buffer maior para dados do email
        int data_len = 0;

        // 220 Service ready
        send(new_socket, "220 CypMail ESMTP Service ready\r\n", strlen("220 CypMail ESMTP Service ready\r\n"), 0);

        while (recv(new_socket, buffer, BUFFER_SIZE - 1, 0) > 0) {
            buffer[strcspn(buffer, "\r\n")] = 0; // Remove CRLF
            printf("Recebido: '%s'\n", buffer);

            if (STRNICMP(buffer, "HELO", 4) == 0 || STRNICMP(buffer, "EHLO", 4) == 0) {
                printf("DEBUG SMTP: Comando HELO/EHLO reconhecido.\n");
                send(new_socket, "250 Hello\r\n", strlen("250 Hello\r\n"), 0);
                state = STATE_HELO;
            } else if (STRNICMP(buffer, "MAIL FROM:", 10) == 0 && state >= STATE_HELO) {
                printf("DEBUG SMTP: Comando MAIL FROM: reconhecido. Buffer: '%s'\n", buffer);
                char* mail_from_start = buffer + 10;
                while (*mail_from_start == ' ') mail_from_start++;
                if (*mail_from_start == '<') {
                    sscanf(mail_from_start, "<%[^>]>", mail_from);
                    printf("DEBUG SMTP: Mail From: '%s'\n", mail_from);
                    send(new_socket, "250 OK\r\n", strlen("250 OK\r\n"), 0);
                    state = STATE_MAIL_FROM;
                } else {
                    printf("DEBUG SMTP: Formato MAIL FROM: inválido.\n");
                    send(new_socket, "501 Syntax error in parameters or arguments\r\n", strlen("501 Syntax error in parameters or arguments\r\n"), 0);
                }
            } else if (STRNICMP(buffer, "RCPT TO:", 8) == 0 && state >= STATE_MAIL_FROM) {
                printf("DEBUG SMTP: Comando RCPT TO: reconhecido. Buffer: '%s'\n", buffer);
                char* rcpt_to_start = buffer + 8;
                while (*rcpt_to_start == ' ') rcpt_to_start++;
                if (*rcpt_to_start == '<') {
                    sscanf(rcpt_to_start, "<%[^>]>", rcpt_to);
                    printf("DEBUG SMTP: Rcpt To: '%s'\n", rcpt_to);
                    send(new_socket, "250 OK\r\n", strlen("250 OK\r\n"), 0);
                    state = STATE_RCPT_TO;
                } else {
                    printf("DEBUG SMTP: Formato RCPT TO: inválido.\n");
                    send(new_socket, "501 Syntax error in parameters or arguments\r\n", strlen("501 Syntax error in parameters or arguments\r\n"), 0);
                }