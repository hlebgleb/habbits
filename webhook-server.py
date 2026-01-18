#!/usr/bin/env python3
"""
Простой webhook-сервер для автоматического деплоя при пуше в GitHub
Запускается как systemd-сервис на порту 9000
"""

from http.server import HTTPServer, BaseHTTPRequestHandler
import subprocess
import json
import hmac
import hashlib
import os

WEBHOOK_SECRET = os.getenv('WEBHOOK_SECRET', 'habbits-deploy-secret-2026')
DEPLOY_SCRIPT = '/opt/habbits/deploy.sh'

class WebhookHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path != '/deploy':
            self.send_response(404)
            self.end_headers()
            return
        
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        # Проверяем подпись GitHub (опционально)
        signature = self.headers.get('X-Hub-Signature-256', '')
        if signature:
            expected = 'sha256=' + hmac.new(
                WEBHOOK_SECRET.encode(),
                body,
                hashlib.sha256
            ).hexdigest()
            if not hmac.compare_digest(signature, expected):
                print("❌ Неверная подпись webhook")
                self.send_response(401)
                self.end_headers()
                return
        
        try:
            payload = json.loads(body)
            ref = payload.get('ref', '')
            
            # Деплоим только при пуше в main
            if ref == 'refs/heads/main':
                print(f"🚀 Получен push в main, запускаем деплой...")
                subprocess.Popen(['/bin/bash', DEPLOY_SCRIPT])
                
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'status': 'deploying'}).encode())
            else:
                print(f"ℹ️ Пуш в {ref}, пропускаем")
                self.send_response(200)
                self.end_headers()
                
        except Exception as e:
            print(f"❌ Ошибка: {e}")
            self.send_response(500)
            self.end_headers()
    
    def log_message(self, format, *args):
        print(f"[webhook] {args[0]}")

if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', 9000), WebhookHandler)
    print("🎣 Webhook-сервер запущен на порту 9000")
    server.serve_forever()
