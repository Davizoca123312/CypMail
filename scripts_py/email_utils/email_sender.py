import smtplib
from email.mime.text import MIMEText

# Assuming SMTP_SERVER_PORT is defined elsewhere or passed as an argument
# For now, hardcode it as it was in app.py
def send_email_python(from_addr, to_addr, subject, body, smtp_port):
    """Envia um email usando o servidor SMTP local."""
    msg = MIMEText(body)
    msg['Subject'] = subject
    msg['From'] = from_addr
    msg['To'] = to_addr

    try:
        with smtplib.SMTP('localhost', smtp_port) as server:
            server.send_message(msg)
        print(f"Email enviado de {from_addr} para {to_addr}")
        return True
    except Exception as e:
        print(f"Erro ao enviar email via smtplib: {e}")
        return False
