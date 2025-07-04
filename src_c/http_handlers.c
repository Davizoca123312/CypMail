#include "http_handlers.h"
#include <string.h>
#include <stdio.h>
#include <stdlib.h>
#include <ctype.h> // For isxdigit

// --- Funções de Resposta HTTP ---
void send_response(SOCKET socket, const char* status, const char* content_type, const char* body, const char* location) {
    char header[BUFFER_SIZE];
    int len = snprintf(header, sizeof(header),
        "%s\r\nContent-Type: %s\r\nContent-Length: %zu\r\n",
        status, content_type, strlen(body));

    if (location) {
        len += snprintf(header + len, sizeof(header) - len, "Location: %s\r\n", location);
    }
    len += snprintf(header + len, sizeof(header) - len, "\r\n%s", body);
    send(socket, header, len, 0);
}

// --- Lógica do Servidor ---
void serve_static_file(SOCKET socket, const char* filename, const char* base_dir) {
    char filepath[256];
    snprintf(filepath, sizeof(filepath), "%s/%s", base_dir, filename);
    FILE* file = fopen(filepath, "rb");
    if (!file) {
        send_response(socket, "HTTP/1.1 404 Not Found", "text/plain", "Not Found", NULL);
        return;
    }
    fseek(file, 0, SEEK_END);
    long file_size = ftell(file);
    fseek(file, 0, SEEK_SET);
    char* content = malloc(file_size);
    fread(content, 1, file_size, file);
    fclose(file);

    char header[BUFFER_SIZE];
    const char* content_type = strstr(filename, ".css") ? "text/css" : (strstr(filename, ".js") ? "application/javascript" : "text/html");
    snprintf(header, sizeof(header), "HTTP/1.1 200 OK\r\nContent-Type: %s\r\nContent-Length: %ld\r\n\r\n", content_type, file_size);
    send(socket, header, strlen(header), 0);
    send(socket, content, file_size, 0);
    free(content);
}

// --- Função para substituir substrings (para decodificação URL) ---
char* str_replace(const char* original, const char* find, const char* replace) {
    char* result;
    char* ins;
    char* tmp;
    int len_find = strlen(find);
    int len_replace = strlen(replace);
    int count;

    for (count = 0, ins = (char*)original; (tmp = strstr(ins, find)); ++count) {
        ins = tmp + len_find;
    }

    result = (char*)malloc(strlen(original) + (len_replace - len_find) * count + 1);
    if (!result) return NULL;

    ins = (char*)original;
    result[0] = '\0';
    while (count--) {
        tmp = strstr(ins, find);
        strncpy(result + strlen(result), ins, tmp - ins);
        strcat(result, replace);
        ins = tmp + len_find;
    }
    strcat(result, ins);
    return result;
}

// --- URL Decode (simplificado) ---
void url_decode(char *dst, const char *src) {
    char a, b;
    while (*src) {
        if ((*src == '%') && ((a = src[1]) && (b = src[2])) &&
            (isxdigit(a) && isxdigit(b))) {
            if (a >= 'a')
                a -= 'a'-'A';
            if (a >= 'A')
                a -= ('A' - 10);
            else
                a -= '0';
            if (b >= 'a')
                b -= 'a'-'A';
            if (b >= 'A')
                b -= ('A' - 10);
            else
                b -= '0';
            *dst++ = 16*a + b;
            src+=3;
        } else if (*src == '+') {
            *dst++ = ' ';
            src++;
        } else {
            *dst++ = *src++;
        }
    }
    *dst++ = '\0';
}

// --- Função para extrair valor de um campo em um corpo de formulário URL-encoded ---
void get_form_field(const char* body, const char* field_name, char* output, size_t output_size) {
    char search_str[64];
    snprintf(search_str, sizeof(search_str), "%s=", field_name);
    
    const char* start = strstr(body, search_str);
    if (!start) {
        output[0] = '\0';
        return;
    }
    start += strlen(search_str);

    const char* end = strchr(start, '&');
    size_t len;
    if (end) {
        len = end - start;
    } else {
        len = strlen(start);
    }

    if (len >= output_size) {
        len = output_size - 1;
    }
    strncpy(output, start, len);
    output[len] = '\0';

    // Decodificar o valor
    char decoded_output[BUFFER_SIZE];
    url_decode(decoded_output, output);
    strncpy(output, decoded_output, output_size);
    output[output_size - 1] = '\0';
}
