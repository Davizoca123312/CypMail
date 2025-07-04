#include "user_db.h"
#include <string.h>

// --- Funções de Banco de Dados (Arquivo de Texto) ---
int user_exists(const char* email) {
    FILE* db = fopen(DB_FILE, "r");
    if (!db) return 0;
    char line[256];
    while (fgets(line, sizeof(line), db)) {
        char stored_email[128];
        sscanf(line, "%[^,],", stored_email);
        if (strcmp(email, stored_email) == 0) {
            fclose(db);
            return 1;
        }
    }
    fclose(db);
    return 0;
}

void add_user(const char* email, const char* password) {
    FILE* db = fopen(DB_FILE, "a");
    if (db) {
        fprintf(db, "%s,%s\n", email, password);
        fclose(db);
    }
}

int check_credentials(const char* email, const char* password) {
    FILE* db = fopen(DB_FILE, "r");
    if (!db) return 0;
    char line[256];
    while (fgets(line, sizeof(line), db)) {
        char stored_email[128], stored_pass[128];
        sscanf(line, "%[^,],%s", stored_email, stored_pass);
        if (strcmp(email, stored_email) == 0 && strcmp(password, stored_pass) == 0) {
            fclose(db);
            return 1;
        }
    }
    fclose(db);
    return 0;
}
