#ifndef HTTP_HANDLERS_H
#define HTTP_HANDLERS_H

#include <winsock2.h>
#include <stddef.h> // For size_t

// Define BUFFER_SIZE se ainda não estiver definido
#ifndef BUFFER_SIZE
#define BUFFER_SIZE 2048
#endif

void send_response(SOCKET socket, const char* status, const char* content_type, const char* body, const char* location);
void serve_static_file(SOCKET socket, const char* filename, const char* base_dir);
char* str_replace(const char* original, const char* find, const char* replace);
void url_decode(char *dst, const char *src);
void get_form_field(const char* body, const char* field_name, char* output, size_t output_size);

#endif // HTTP_HANDLERS_H
