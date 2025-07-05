import os
import json
import re
from email import message_from_string
from email.utils import parseaddr

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
        'from_display': msg.get('From', 'Desconhecido'),
        'from_email': parseaddr(msg.get('From', ''))[1], # Extrai apenas o endereço de email
        'subject': msg.get('Subject', 'Sem Assunto'),
        'body': body.strip()
    }

def list_emails_json(user_email, mailbox_dir, tab_type='inbox'):
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
            
            # Filtering logic based on tab_type
            if tab_type == 'inbox' or tab_type == 'allMail':
                # Inbox and All Mail show all emails for now
                pass
            elif tab_type == 'sent':
                # Only show emails sent by the current user
                if email_details['from_email'] != user_email:
                    continue # Skip this email if it's not sent by the user
            # For other tabs (starred, postponed, drafts, important, chats, scheduled, spam, trash),
            # for now, we'll just show all emails.
            # In a real application, these would require additional metadata on the emails
            # (e.g., a flag in the .eml file or a separate database)

            emails_data.append({
                'id': os.path.basename(filepath),
                'from_display': email_details['from_display'],
                'from_email': email_details['from_email'],
                'subject': email_details['subject'],
                'body': email_details['body']
            })
            
    return json.dumps(emails_data)

