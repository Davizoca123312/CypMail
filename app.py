from flask import Flask, request, jsonify, send_from_directory, redirect, url_for
from flask_socketio import SocketIO, emit, join_room, leave_room
import os
import datetime
from email.utils import make_msgid

app = Flask(__name__)
socketio = SocketIO(app)

# --- Configurações ---
HTTP_PORT = 8080
DB_FILE = 'users.db'
MAILBOX_DIR = 'mailboxes'

# --- Mapeamento de usuários para SIDs do Socket.IO ---
user_sids = {}

# --- Funções de Banco de Dados (Python) ---
def user_exists(email):
    if not os.path.exists(DB_FILE):
        return False
    with open(DB_FILE, 'r') as f:
        for line in f:
            stored_email = line.strip().split(',')[0]
            if stored_email == email:
                return True
    return False

def add_user(email, password):
    with open(DB_FILE, 'a') as f:
        f.write(f'{email},{password}\n')
    # Cria a caixa de correio para o novo usuário
    user_mailbox_path = os.path.join(MAILBOX_DIR, email.split('@')[0])
    if not os.path.exists(user_mailbox_path):
        os.makedirs(user_mailbox_path)

def check_credentials(email, password):
    if not os.path.exists(DB_FILE):
        return False
    with open(DB_FILE, 'r') as f:
        for line in f:
            stored_email, stored_pass = line.strip().split(',')
            if stored_email == email and stored_pass == password:
                return True
    return False

from scripts_py.email_utils.email_parser import list_emails_json

# --- Nova Função para Salvar Email ---
def save_email_to_mailbox(to_email, from_email, subject, body):
    """Salva um e-mail diretamente no sistema de arquivos do destinatário."""
    recipient_username = to_email.split('@')[0]
    mailbox_path = os.path.join(MAILBOX_DIR, recipient_username)

    if not os.path.exists(mailbox_path):
        # Se o destinatário não existir, não podemos entregar.
        return False

    # Cria um cabeçalho de e-mail simples
    email_content = f"From: {from_email}\n"
    email_content += f"To: {to_email}\n"
    email_content += f"Subject: {subject}\n"
    email_content += f"Date: {datetime.datetime.now().strftime('%a, %d %b %Y %H:%M:%S %z')}\n"
    email_content += f"Message-ID: {make_msgid()}\n\n"
    email_content += body

    # Gera um nome de arquivo único
    email_filename = os.path.join(mailbox_path, f"{datetime.datetime.now().strftime('%Y%m%d%H%M%S')}_{make_msgid().replace('<','').replace('>','')}.eml")

    try:
        with open(email_filename, 'w') as f:
            f.write(email_content)
        print(f"Email de {from_email} para {to_email} salvo em {email_filename}")
        return True
    except Exception as e:
        print(f"Erro ao salvar email: {e}")
        return False

# --- Rotas HTTP ---
@app.route('/')
def index():
    return send_from_directory('docs', 'index.html')

@app.route('/user/<path:user_email>')
def user_main(user_email):
    return send_from_directory('docs_main', 'index.html')

@app.route('/register', methods=['POST'])
def register():
    email = request.form.get('email')
    password = request.form.get('password')
    if not email or not password or not email.endswith("@cypmail.com") or len(password) < 8:
        return "Dados de cadastro inválidos.", 400
    if user_exists(email):
        return "Usuário já existe.", 409
    add_user(email, password)
    return "Cadastro realizado com sucesso!", 201

@app.route('/login', methods=['POST'])
def login():
    email = request.form.get('email')
    password = request.form.get('password')
    if check_credentials(email, password):
        return redirect(url_for('user_main', user_email=email))
    else:
        return "Email ou senha inválidos.", 401

@app.route('/api/inbox')
def inbox():
    # O email do usuário agora é passado como um argumento de consulta
    user_email = request.args.get('user_email')
    if user_email:
        inbox_json = list_emails_json(user_email, MAILBOX_DIR)
        return inbox_json, 200, {'Content-Type': 'application/json'}
    else:
        return "Email do usuário não fornecido.", 400

# --- Eventos Socket.IO ---
@socketio.on('connect')
def handle_connect():
    print(f"Cliente conectado: {request.sid}")

@socketio.on('register_user')
def handle_register_user(email):
    """Associa um email de usuário ao seu SID e a uma sala."""
    if email:
        user_sids[email] = request.sid
        join_room(email) # Usa o email como nome da sala
        print(f"Usuário {email} registrado com SID {request.sid} e entrou na sala {email}")

@socketio.on('disconnect')
def handle_disconnect():
    # Encontra qual usuário desconectou e o remove
    disconnected_user = next((user for user, sid in user_sids.items() if sid == request.sid), None)
    if disconnected_user:
        del user_sids[disconnected_user]
        leave_room(disconnected_user)
        print(f"Usuário {disconnected_user} (SID: {request.sid}) desconectado.")

@socketio.on('send_email')
def handle_send_email(data):
    to = data.get('to')
    subject = data.get('subject')
    body = data.get('body')
    from_email = data.get('from')

    if not all([to, subject, body, from_email]):
        emit('send_email_response', {'status': 'error', 'message': 'Todos os campos são obrigatórios.'})
        return

    if not user_exists(to):
        emit('send_email_response', {'status': 'error', 'message': 'O destinatário não existe.'})
        return

    if save_email_to_mailbox(to, from_email, subject, body):
        emit('send_email_response', {'status': 'success', 'message': 'Email enviado com sucesso!'})
        # Notifica o destinatário se ele estiver online
        socketio.emit('new_email', {'from': from_email, 'subject': subject}, room=to)
        print(f"Notificação de novo email enviada para a sala {to}")
    else:
        emit('send_email_response', {'status': 'error', 'message': 'Erro ao salvar o email no servidor.'})

# --- Servir arquivos estáticos (CSS, JS) ---
@app.route('/main_style.css')
def main_style():
    return send_from_directory('docs_main', 'main_style.css')

@app.route('/main_script.js')
def main_script():
    return send_from_directory('docs_main', 'main_script.js')

@app.route('/style.css')
def style():
    return send_from_directory('docs', 'style.css')

@app.route('/script.js')
def script():
    return send_from_directory('docs', 'script.js')

if __name__ == '__main__':
    if not os.path.exists(MAILBOX_DIR):
        os.makedirs(MAILBOX_DIR)
    socketio.run(app, host='0.0.0.0', port=HTTP_PORT, allow_unsafe_werkzeug=True)
