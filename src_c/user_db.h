#ifndef USER_DB_H
#define USER_DB_H

#include <stdio.h>

#define DB_FILE "users.db"

int user_exists(const char* email);
void add_user(const char* email, const char* password);
int check_credentials(const char* email, const char* password);

#endif // USER_DB_H
