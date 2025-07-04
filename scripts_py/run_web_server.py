import ctypes
import os

# Construa o caminho para a DLL
script_dir = os.path.dirname(__file__)
project_root = os.path.dirname(script_dir)
bin_dir = os.path.join(project_root, 'bin')
dll_path = os.path.join(bin_dir, 'cypmail.dll')

# Verifique se a DLL existe
if not os.path.exists(dll_path):
    print(f"Erro: DLL não encontrada em {dll_path}")
    print("Compile o código C com: gcc -shared -o bin/cypmail.dll src_c/*.c -lws2_32")
    exit(1)

# Carregue a DLL
c_lib = ctypes.CDLL(dll_path)

# Defina a assinatura da função
c_lib.start_http_server.restype = ctypes.c_int

print("Iniciando o servidor HTTP na porta 8080...")

# Chame a função do servidor
exit_code = c_lib.start_http_server()

print(f"Servidor encerrado com código: {exit_code}")
