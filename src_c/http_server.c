#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include "winsock_utils.h"
#include "user_db.h"
#include "http_handlers.h"
#include "email_utils.h"

#ifdef _WIN32
#include <ws2tcpip.h>
#include <io.h> // For _findfirst, _findnext
#else
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>
#include <dirent.h> // For opendir, readdir
#endif

#define HTTP_PORT 8080
#define SMTP_SERVER_PORT 2525 // Porta do nosso próprio servidor SMTP
#define BUFFER_SIZE 2048

// Função principal do servidor HTTP
int start_http_server() {
    initialize_winsock();
    int server_fd, new_socket;
    struct sockaddr_in address;
    int addrlen = sizeof(address);

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(HTTP_PORT);

    bind(server_fd, (struct sockaddr *)&address, sizeof(address));
    listen(server_fd, 10);

    printf("Servidor HTTP rodando em http://localhost:%d\n", HTTP_PORT);

    // Variável global para armazenar o email do usuário logado (SIMPLIFICADO!)
    // Em um sistema real, isso seria gerenciado por sessões/tokens.
    static char logged_in_user_email[128] = {0};

    while ((new_socket = accept(server_fd, (struct sockaddr *)&address, (socklen_t*)&addrlen)) >= 0) {
        char buffer[BUFFER_SIZE] = {0};
        recv(new_socket, buffer, BUFFER_SIZE - 1, 0);

        char method[16], path[256];
        sscanf(buffer, "%s %s", method, path);

        if (strcmp(method, "POST") == 0) {
            char* body = strstr(buffer, "\r\n\r\n");
            if (body) {
                body += 4; // Pula os caracteres de nova linha
                char email[128] = {0}, password[128] = {0};
                char to[128] = {0}, subject[256] = {0}, msg_body[BUFFER_SIZE] = {0}, from[128] = {0};

                if (strcmp(path, "/register") == 0 || strcmp(path, "/login") == 0) {
                    get_form_field(body, "email", email, sizeof(email));
                    get_form_field(body, "password", password, sizeof(password));
                } else if (strcmp(path, "/api/send_email") == 0) {
                    get_form_field(body, "to", to, sizeof(to));
                    get_form_field(body, "subject", subject, sizeof(subject));
                    get_form_field(body, "body", msg_body, sizeof(msg_body));
                    get_form_field(body, "from", from, sizeof(from));

                    if (send_smtp_email(from, to, subject, msg_body)) {
                        send_response(new_socket, "HTTP/1.1 200 OK", "text/plain", "Email enviado com sucesso!", NULL);
                    } else {
                        send_response(new_socket, "HTTP/1.1 500 Internal Server Error", "text/plain", "Erro ao enviar email.", NULL);
                    }
                }

                if (strcmp(path, "/register") == 0) {
                    const char* domain = "@cypmail.com";
                    printf("DEBUG: Email recebido para registro: %s\n", email);
                    printf("DEBUG: Comprimento do email: %zu, Comprimento do dominio: %zu\n", strlen(email), strlen(domain));
                    if (strlen(email) < strlen(domain) || strcmp(email + strlen(email) - strlen(domain), domain) != 0) {
                        printf("DEBUG: Validacao de dominio falhou.\n");
                        send_response(new_socket, "HTTP/1.1 400 Bad Request", "text/plain", "Erro: O email deve ser @cypmail.com", NULL);
                    } else if (strlen(password) < 8) {
                        printf("DEBUG: Validacao de senha falhou. Comprimento: %zu\n", strlen(password));
                        send_response(new_socket, "HTTP/1.1 400 Bad Request", "text/plain", "Erro: A senha deve ter no minimo 8 caracteres.", NULL);
                    } else if (user_exists(email)) {
                        printf("DEBUG: Usuario ja existe.\n");
                        send_response(new_socket, "HTTP/1.1 409 Conflict", "text/plain", "Usuario ja existe.", NULL);
                    }
                    else {
                        printf("DEBUG: Cadastro bem-sucedido para %s.\n", email);
                        add_user(email, password);
                        send_response(new_socket, "HTTP/1.1 201 Created", "text/plain", "Cadastro realizado com sucesso!", NULL);
                    }
                } else if (strcmp(path, "/login") == 0) {
                    if (check_credentials(email, password)) {
                        strcpy(logged_in_user_email, email); // Armazena o email do usuário logado
                        // Serve index.html directly from docs_main instead of redirecting
                        serve_static_file(new_socket, "index.html", "docs_main");
                    } else {
                        send_response(new_socket, "HTTP/1.1 401 Unauthorized", "text/plain", "Email ou senha invalidos.", NULL);
                    }
                }
            }
        } else { // GET
            if (strcmp(path, "/") == 0) {
                serve_static_file(new_socket, "index.html", "docs");
            } else if (strncmp(path, "/user/", 6) == 0) {
                // Extract username from path
                char* user_email_from_url = path + 6;
                // This is a simplified session management. In a real app, you'd validate this user.
                strcpy(logged_in_user_email, user_email_from_url);
                serve_static_file(new_socket, "index.html", "docs_main");
            } else if (strcmp(path, "/api/inbox") == 0) {
                if (strlen(logged_in_user_email) > 0) {
                    char* inbox_json = list_emails_json(logged_in_user_email);
                    send_response(new_socket, "HTTP/1.1 200 OK", "application/json", inbox_json, NULL);
                    free(inbox_json);
                } else {
                    send_response(new_socket, "HTTP/1.1 401 Unauthorized", "text/plain", "Nao logado.", NULL);
                }
            } else { // Handle all other GET requests as static files
                char filename_to_serve[256];
                const char* base_dir_to_serve = "docs"; // Default to docs

                // If the path starts with /user/, strip it to get the actual file name
                if (strncmp(path, "/user/", 6) == 0) {
                    // For requests like /user/test@cypmail.com/main_style.css or /user/test@cypmail.com/main_script.js
                    char* file_part = strchr(path + 6, '/');
                    if (file_part) {
                        strcpy(filename_to_serve, file_part + 1);
                        base_dir_to_serve = "docs_main"; // Serve from docs_main for these assets
                    } else {
                        // If no specific file is requested after /user/, serve index.html from docs_main
                        strcpy(filename_to_serve, "index.html");
                        base_dir_to_serve = "docs_main";
                    }
                
                } else if (path[0] == '/') {
                    strcpy(filename_to_serve, path + 1);
                } else {
                    strcpy(filename_to_serve, path);
                }

                // If filename_to_serve is empty, serve index.html from the determined base_dir
                if (strlen(filename_to_serve) == 0) {
                    strcpy(filename_to_serve, "index.html");
                }
                printf("DEBUG: Serving static file: %s from %s for path: %s\n", filename_to_serve, base_dir_to_serve, path);
                serve_static_file(new_socket, filename_to_serve, base_dir_to_serve);
            }
        }

    #ifdef _WIN32
        closesocket(new_socket);
    #else
        close(new_socket);
    #endif
    }

    #ifdef _WIN32
    closesocket(server_fd);
    #else
    close(server_fd);
    #endif
    cleanup_winsock();
    return 0;
}

int main() {
    return start_http_server();
}