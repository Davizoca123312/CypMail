#include "email_utils.h"
#include "winsock_utils.h"
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#ifdef _WIN32
#include <io.h> // For _findfirst, _findnext
#else
#include <dirent.h> // For opendir, readdir
#endif

#define SMTP_SERVER_PORT 2525 // Porta do nosso próprio servidor SMTP

// --- Funções de Email e JSON ---
char* get_username_from_email(const char* email) {
    static char username[128];
    strncpy(username, email, sizeof(username) - 1);
    username[sizeof(username) - 1] = '\0';
    char* at_sign = strchr(username, '@');
    if (at_sign) {
        *at_sign = '\0';
    }
    return username;
}

void parse_email_header(const char* email_content, char* from, char* subject) {
    const char* from_tag = "From: ";
    const char* subject_tag = "Subject: ";
    const char* line_end;

    // Parse From
    const char* from_start = strstr(email_content, from_tag);
    if (from_start) {
        from_start += strlen(from_tag);
        line_end = strstr(from_start, "\n");
        if (line_end) {
            strncpy(from, from_start, line_end - from_start);
            from[line_end - from_start] = '\0';
        } else {
            strcpy(from, from_start);
        }
    } else {
        strcpy(from, "Desconhecido");
    }

    // Parse Subject
    const char* subject_start = strstr(email_content, subject_tag);
    if (subject_start) {
        subject_start += strlen(subject_tag);
        line_end = strstr(subject_start, "\n");
        if (line_end) {
            strncpy(subject, subject_start, line_end - subject_start);
            subject[line_end - subject_start] = '\0';
        } else {
            strcpy(subject, subject_start);
        }
    } else {
        strcpy(subject, "Sem Assunto");
    }
}

char* list_emails_json(const char* user_email) {
    char mailbox_path[256];
    char* username = get_username_from_email(user_email);
    snprintf(mailbox_path, sizeof(mailbox_path), "mailboxes/%s", username);

    char* json_buffer = (char*)malloc(BUFFER_SIZE * 10); // Buffer grande para JSON
    if (!json_buffer) return strdup("[]");
    strcpy(json_buffer, "[");

#ifdef _WIN32
    struct _finddata_t file_info;
    long hFile;
    char search_path[256];
    snprintf(search_path, sizeof(search_path), "%s/*.eml", mailbox_path);

    if ((hFile = _findfirst(search_path, &file_info)) == -1L) {
        strcat(json_buffer, "]");
        return json_buffer;
    }

    int first_entry = 1;
    do {
        if (!(file_info.attrib & _A_SUBDIR)) { // Se não for um subdiretório
            char filepath[BUFFER_SIZE];
            snprintf(filepath, sizeof(filepath), "%s/%s", mailbox_path, file_info.name);

            FILE* fp = fopen(filepath, "r");
            if (fp) {
                fseek(fp, 0, SEEK_END);
                long file_size = ftell(fp);
                fseek(fp, 0, SEEK_SET);
                char* email_content = (char*)malloc(file_size + 1);
                fread(email_content, 1, file_size, fp);
                email_content[file_size] = '\0';
                fclose(fp);

                char from[128], subject[256];
                parse_email_header(email_content, from, subject);

                if (!first_entry) {
                    strcat(json_buffer, ",");
                }
                char email_json[BUFFER_SIZE];
                snprintf(email_json, sizeof(email_json),
                    "{\"id\":\"%s\", \"from\":\"%s\", \"subject\":\"%s\", \"snippet\":\"%s\"}",
                    file_info.name, from, subject, ""); // Snippet vazio por enquanto
                strcat(json_buffer, email_json);
                first_entry = 0;
                free(email_content);
            }
        }
    } while (_findnext(hFile, &file_info) == 0);
    _findclose(hFile);

#else // POSIX
    DIR* dir;
    struct dirent* entry;
    if ((dir = opendir(mailbox_path)) == NULL) {
        strcat(json_buffer, "]");
        return json_buffer;
    }

    int first_entry = 1;
    while ((entry = readdir(dir)) != NULL) {
        if (entry->d_type == DT_REG && strstr(entry->d_name, ".eml")) {
            char filepath[BUFFER_SIZE];
            snprintf(filepath, sizeof(filepath), "%s/%s", mailbox_path, entry->d_name);

            FILE* fp = fopen(filepath, "r");
            if (fp) {
                fseek(fp, 0, SEEK_END);
                long file_size = ftell(fp);
                fseek(fp, 0, SEEK_SET);
                char* email_content = (char*)malloc(file_size + 1);
                fread(email_content, 1, file_size, fp);
                email_content[file_size] = '\0';
                fclose(fp);

                char from[128], subject[256];
                parse_email_header(email_content, from, subject);

                if (!first_entry) {
                    strcat(json_buffer, ",");
                }
                char email_json[BUFFER_SIZE];
                snprintf(email_json, sizeof(email_json),
                    "{\"id\":\"%s\", \"from\":\"%s\", \"subject\":\"%s\", \"snippet\":\"%s\"}",
                    entry->d_name, from, subject, ""); // Snippet vazio por enquanto
                strcat(json_buffer, email_json);
                first_entry = 0;
                free(email_content);
            }
        }
    }
    closedir(dir);
#endif

    strcat(json_buffer, "]");
    return json_buffer;
}

// --- Cliente SMTP para Envio de Email ---
int send_smtp_email(const char* from, const char* to, const char* subject, const char* body) {
    SOCKET smtp_socket;
    struct sockaddr_in server_addr;
    char buffer[BUFFER_SIZE];
    int bytes_received;

    initialize_winsock();

    smtp_socket = socket(AF_INET, SOCK_STREAM, 0);
    if (smtp_socket == INVALID_SOCKET) {
        printf("Erro ao criar socket SMTP: %d\n", WSAGetLastError());
        cleanup_winsock();
        return 0;
    }

    server_addr.sin_family = AF_INET;
    server_addr.sin_port = htons(SMTP_SERVER_PORT);
    server_addr.sin_addr.s_addr = inet_addr("127.0.0.1"); // Conecta ao nosso próprio servidor SMTP

    if (connect(smtp_socket, (struct sockaddr*)&server_addr, sizeof(server_addr)) == SOCKET_ERROR) {
        printf("Erro ao conectar ao servidor SMTP: %d\n", WSAGetLastError());
        closesocket(smtp_socket);
        cleanup_winsock();
        return 0;
    }

    // Recebe a mensagem de boas-vindas (220)
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // HELO
    send(smtp_socket, "HELO localhost\r\n", strlen("HELO localhost\r\n"), 0);
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // MAIL FROM
    snprintf(buffer, sizeof(buffer), "MAIL FROM:<%s>\r\n", from);
    send(smtp_socket, buffer, strlen(buffer), 0);
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // RCPT TO
    snprintf(buffer, sizeof(buffer), "RCPT TO:<%s>\r\n", to);
    send(smtp_socket, buffer, strlen(buffer), 0);
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // DATA
    send(smtp_socket, "DATA\r\n", strlen("DATA\r\n"), 0);
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // Conteúdo do Email
    char email_content[BUFFER_SIZE * 2]; // Ajuste o tamanho conforme necessário
    snprintf(email_content, sizeof(email_content),
        "From: %s\r\nTo: %s\r\nSubject: %s\r\n\r\n%s\r\n.",
        from, to, subject, body);
    send(smtp_socket, email_content, strlen(email_content), 0);

    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    // QUIT
    send(smtp_socket, "QUIT\r\n", strlen("QUIT\r\n"), 0);
    bytes_received = recv(smtp_socket, buffer, BUFFER_SIZE - 1, 0);
    buffer[bytes_received] = '\0';
    printf("SMTP Recv: %s\n", buffer);

    closesocket(smtp_socket);
    cleanup_winsock();
    return 1;
}
