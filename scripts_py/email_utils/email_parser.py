import os
import json
import re
from email import message_from_string

def get_username_from_email(email):
    return email.split('@')[0]

def parse_email_content(email_content):
    """Analisa o conteúdo completo do e-mail, incluindo cabeçalhos e corpo."""
    msg = message_from_string(email_content)
    
    body = ""
    if msg.is_multipart():
        for part in msg.walk():
            ctype = part.get_content_type()
            cdispo = str(part.get('Content-Disposition'))

            # Pula anexos e partes não-texto
            if ctype == 'text/plain' and 'attachment' not in cdispo:
                body = part.get_payload(decode=True).decode('utf-8', errors='ignore')
                break
    else:
        # Trata e-mails não-multipart
        body = msg.get_payload(decode=True).decode('utf-8', errors='ignore')

    return {
        'from': msg.get('From', 'Desconhecido'),
        'subject': msg.get('Subject', 'Sem Assunto'),
        'body': body.strip()
    }

def list_emails_json(user_email, mailbox_dir):
    username = get_username_from_email(user_email)
    mailbox_path = os.path.join(mailbox_dir, username)
    emails_data = []

    if not os.path.exists(mailbox_path):
        return json.dumps([])

    # Ordena os arquivos por data de modificação (mais recentes primeiro)
    try:
        files = sorted(
            [os.path.join(mailbox_path, f) for f in os.listdir(mailbox_path) if f.endswith('.eml')],
            key=os.path.getmtime,
            reverse=True
        )
    except OSError:
        return json.dumps([])

    for filepath in files:
        with open(filepath, 'r', encoding='utf-8', errors='ignore') as f:
            email_content = f.read()
            email_details = parse_email_content(email_content)
            emails_data.append({
                'id': os.path.basename(filepath),
                'from': email_details['from'],
                'subject': email_details['subject'],
                'body': email_details['body']
            })
            
    return json.dumps(emails_data)

