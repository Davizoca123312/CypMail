#include "winsock_utils.h"
#include <stdio.h>
#include <stdlib.h>

#ifdef _WIN32
void initialize_winsock() {
    WSADATA wsaData;
    if (WSAStartup(MAKEWORD(2, 2), &wsaData) != 0) {
        printf("WSAStartup falhou.\n");
        exit(1);
    }
}

void cleanup_winsock() {
    WSACleanup();
}
#endif

