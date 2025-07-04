#ifndef EMAIL_UTILS_H
#define EMAIL_UTILS_H

#include <winsock2.h>

#ifndef BUFFER_SIZE
#define BUFFER_SIZE 2048
#endif

char* get_username_from_email(const char* email);
void parse_email_header(const char* email_content, char* from, char* subject);
char* list_emails_json(const char* user_email);
int send_smtp_email(const char* from, const char* to, const char* subject, const char* body);

#endif // EMAIL_UTILS_H
