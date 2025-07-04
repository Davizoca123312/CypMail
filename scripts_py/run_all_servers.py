import os
import subprocess
import time
import sys

# --- Caminhos ---
script_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(script_dir))
app_py_path = os.path.join(project_root, 'C:/Users/ranci/Desktop/CypMail/app.py')

# --- Iniciar Servidor ---
def start_server(command, name):
    print(f"Iniciando {name}...")
    # Usar sys.executable para garantir que o python correto seja usado
    process = subprocess.Popen([sys.executable, command], cwd=project_root)
    print(f"{name} iniciado com PID: {process.pid}")
    return process

if __name__ == '__main__':
    # Iniciar Servidor Unificado (Flask + SocketIO)
    server_process = start_server(app_py_path, "Servidor CypMail (Web + Email WebSocket)")

    print("\nServidor CypMail rodando.")
    print(" - Acesse a interface em http://localhost:8080")
    print("\nPressione Ctrl+C para parar o servidor.")

    try:
        # Espera o processo do servidor terminar
        server_process.wait()
    except KeyboardInterrupt:
        print("\nEncerrando o servidor... Tchau!")
        server_process.terminate()
        server_process.wait()
        print("Servidor encerrado.")
    except Exception as e:
        print(f"Ocorreu um erro: {e}")
        server_process.terminate()
        server_process.wait()
