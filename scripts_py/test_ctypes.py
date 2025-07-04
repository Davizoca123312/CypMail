import ctypes
import os

# Construa o caminho para a DLL
# O script está em scripts_py, a DLL em bin
script_dir = os.path.dirname(__file__)
project_root = os.path.dirname(script_dir)
bin_dir = os.path.join(project_root, 'bin')
dll_path = os.path.join(bin_dir, 'cypmail.dll')

# Verifique se a DLL existe
if not os.path.exists(dll_path):
    print(f"Erro: DLL não encontrada em {dll_path}")
    print("Certifique-se de que o código C foi compilado.")
    exit(1)

# Carregue a DLL
c_lib = ctypes.CDLL(dll_path)

# Defina o tipo de retorno da função
c_lib.get_hello_message.restype = ctypes.c_char_p

# Chame a função e decodifique o resultado
message = c_lib.get_hello_message().decode('utf-8')

print(message)
