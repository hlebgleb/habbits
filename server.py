#!/usr/bin/env python3
"""
Прокси-сервер для обхода CORS при работе с Notion API
+ Push-уведомления для PWA
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import sys
import json
from pathlib import Path

# Push notifications
try:
    from pywebpush import webpush, WebPushException
    PUSH_AVAILABLE = True
except ImportError:
    PUSH_AVAILABLE = False
    print("⚠️ pywebpush не установлен, push-уведомления недоступны")

app = Flask(__name__, static_folder='.')
CORS(app)

# Путь для хранения подписок (используем /app/data в Docker)
if os.path.exists('/app/data'):
    SUBSCRIPTIONS_FILE = Path('/app/data/push_subscriptions.json')
elif os.path.exists('/opt/habbits'):
    SUBSCRIPTIONS_FILE = Path('/opt/habbits/push_subscriptions.json')
else:
    SUBSCRIPTIONS_FILE = Path('push_subscriptions.json')

# Загружаем конфигурацию из переменных окружения
NOTION_TOKEN = os.getenv('NOTION_TOKEN')
# База данных для Глеба (по умолчанию)
GLEB_DATABASE_ID = os.getenv('DATABASE_ID')  # Для обратной совместимости
GLEB_ENERGY_DATABASE_ID = os.getenv('ENERGY_DATABASE_ID', '')  # Опционально
GLEB_ENERGY_DATA_SOURCE_ID = os.getenv('ENERGY_DATA_SOURCE_ID', '')  # Опционально
# База данных для Даши
DASHA_DATABASE_ID = os.getenv('DASHA_DATABASE_ID', '')

# VAPID ключи для push-уведомлений
# Генерируются один раз: python -c "from pywebpush import webpush; from cryptography.hazmat.primitives.asymmetric import ec; from cryptography.hazmat.backends import default_backend; import base64; key = ec.generate_private_key(ec.SECP256R1(), default_backend()); print('Private:', base64.urlsafe_b64encode(key.private_numbers().private_value.to_bytes(32, 'big')).decode()); pub = key.public_key().public_numbers(); print('Public:', base64.urlsafe_b64encode(b'\\x04' + pub.x.to_bytes(32, 'big') + pub.y.to_bytes(32, 'big')).decode())"
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY', '')
VAPID_CLAIMS = {
    "sub": "mailto:gleb@hlebgleb.ru"  # Замените на ваш email
}

if not NOTION_TOKEN:
    print("❌ Ошибка: Не установлена переменная окружения NOTION_TOKEN")
    print("   Установите ее в настройках Render или через .env файл")
    sys.exit(1)

if not GLEB_DATABASE_ID:
    print("❌ Ошибка: Не установлена переменная окружения DATABASE_ID (для Глеба)")
    print("   Установите ее в настройках Render или через .env файл")
    sys.exit(1)

NOTION_API_VERSION = '2025-09-03'  # Версия с поддержкой multi-source databases
NOTION_API_BASE = 'https://api.notion.com/v1'

@app.route('/')
def index():
    """Главная страница - редирект на /gleb"""
    from flask import redirect
    return redirect('/gleb')

@app.route('/gleb')
def gleb():
    """Страница для Глеба"""
    return send_from_directory('.', 'index.html')

@app.route('/gleb/stat')
def gleb_stat():
    """Страница статистики для Глеба"""
    return send_from_directory('.', 'stat.html')

@app.route('/dasha')
def dasha():
    """Страница для Даши"""
    return send_from_directory('.', 'index.html')

@app.route('/api/config')
def get_config():
    """Получить конфигурацию для клиента"""
    # Определяем пользователя из заголовка Referer или параметра
    user = request.args.get('user', 'gleb')
    
    if user == 'dasha':
        if not DASHA_DATABASE_ID:
            return jsonify({'error': 'DASHA_DATABASE_ID не настроен'}), 500
        return jsonify({
            'DATABASE_ID': DASHA_DATABASE_ID,
            'ENERGY_DATABASE_ID': None,  # У Даши нет вопроса об энергии
            'ENERGY_DATA_SOURCE_ID': None,
            'USER': 'dasha'
        })
    else:
        # Глеб (по умолчанию)
        return jsonify({
            'DATABASE_ID': GLEB_DATABASE_ID,
            'ENERGY_DATABASE_ID': GLEB_ENERGY_DATABASE_ID or None,
            'ENERGY_DATA_SOURCE_ID': GLEB_ENERGY_DATA_SOURCE_ID or None,
            'USER': 'gleb'
        })

@app.route('/<path:path>')
def static_files(path):
    """Статические файлы"""
    return send_from_directory('.', path)

# ==================== Push Notifications ====================

def load_subscriptions():
    """Загрузить подписки из файла"""
    if SUBSCRIPTIONS_FILE.exists():
        try:
            with open(SUBSCRIPTIONS_FILE, 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_subscriptions(subscriptions):
    """Сохранить подписки в файл"""
    with open(SUBSCRIPTIONS_FILE, 'w') as f:
        json.dump(subscriptions, f, indent=2)

@app.route('/api/push/vapid-key')
def get_vapid_key():
    """Получить публичный VAPID ключ"""
    if not VAPID_PUBLIC_KEY:
        return jsonify({'error': 'VAPID ключи не настроены'}), 500
    return jsonify({'publicKey': VAPID_PUBLIC_KEY})

@app.route('/api/push/subscribe', methods=['POST'])
def push_subscribe():
    """Подписаться на push-уведомления"""
    if not PUSH_AVAILABLE:
        return jsonify({'error': 'Push не поддерживается'}), 500
    
    data = request.get_json()
    subscription = data.get('subscription')
    user = data.get('user', 'gleb')
    
    if not subscription:
        return jsonify({'error': 'Нет данных подписки'}), 400
    
    # Загружаем существующие подписки
    subscriptions = load_subscriptions()
    
    # Добавляем подписку для пользователя
    if user not in subscriptions:
        subscriptions[user] = []
    
    # Проверяем, нет ли уже такой подписки
    endpoint = subscription.get('endpoint')
    existing_endpoints = [s.get('endpoint') for s in subscriptions[user]]
    
    if endpoint not in existing_endpoints:
        subscriptions[user].append(subscription)
        save_subscriptions(subscriptions)
        print(f"✅ Добавлена push-подписка для {user}")
    
    return jsonify({'success': True})

@app.route('/api/push/unsubscribe', methods=['POST'])
def push_unsubscribe():
    """Отписаться от push-уведомлений"""
    data = request.get_json()
    endpoint = data.get('endpoint')
    user = data.get('user', 'gleb')
    
    if not endpoint:
        return jsonify({'error': 'Нет endpoint'}), 400
    
    subscriptions = load_subscriptions()
    
    if user in subscriptions:
        subscriptions[user] = [s for s in subscriptions[user] if s.get('endpoint') != endpoint]
        save_subscriptions(subscriptions)
        print(f"✅ Удалена push-подписка для {user}")
    
    return jsonify({'success': True})

@app.route('/api/push/send', methods=['POST'])
def send_push():
    """Отправить push-уведомление (для тестирования)"""
    if not PUSH_AVAILABLE:
        return jsonify({'error': 'Push не поддерживается'}), 500
    
    if not VAPID_PRIVATE_KEY:
        return jsonify({'error': 'VAPID ключи не настроены'}), 500
    
    data = request.get_json()
    user = data.get('user', 'gleb')
    message = data.get('message', 'Не забудь отметить привычки!')
    
    subscriptions = load_subscriptions()
    user_subs = subscriptions.get(user, [])
    
    if not user_subs:
        return jsonify({'error': 'Нет подписок для пользователя'}), 404
    
    sent = 0
    failed = 0
    
    payload = json.dumps({
        'title': 'Трекер Привычек',
        'body': message,
        'icon': '/icons/icon-192.png',
        'data': {'url': f'/{user}'}
    })
    
    for sub in user_subs:
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            sent += 1
        except WebPushException as e:
            print(f"❌ Ошибка отправки push: {e}")
            failed += 1
            # Если подписка невалидна, удаляем её
            if e.response and e.response.status_code in [404, 410]:
                subscriptions[user] = [s for s in subscriptions[user] if s.get('endpoint') != sub.get('endpoint')]
                save_subscriptions(subscriptions)
    
    return jsonify({'sent': sent, 'failed': failed})

# ==================== Notion API Proxy ====================

@app.route('/api/notion/<path:endpoint>', methods=['GET', 'POST', 'PATCH'])
def notion_proxy(endpoint):
    """Прокси для запросов к Notion API"""
    try:
        url = f"{NOTION_API_BASE}/{endpoint}"
        
        headers = {
            'Authorization': f'Bearer {NOTION_TOKEN}',
            'Notion-Version': NOTION_API_VERSION,
            'Content-Type': 'application/json',
        }
        
        # Получаем тело запроса если есть
        body = None
        if request.method in ['POST', 'PATCH']:
            body = request.get_json()
        
        # Выполняем запрос к Notion API
        if request.method == 'GET':
            response = requests.get(url, headers=headers)
        elif request.method == 'POST':
            response = requests.post(url, headers=headers, json=body)
        elif request.method == 'PATCH':
            response = requests.patch(url, headers=headers, json=body)
        else:
            return jsonify({'error': 'Method not allowed'}), 405
        
        # Возвращаем ответ
        if response.status_code >= 400:
            error_data = response.json() if response.content else {'error': 'No response body'}
            print(f"❌ Notion API ошибка {response.status_code} для {endpoint}: {error_data}")
            return jsonify(error_data), response.status_code
        
        return jsonify(response.json())
        
    except Exception as e:
        print(f"Ошибка прокси к Notion: {e}")
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    port = int(os.getenv('PORT', 3000))
    debug = os.getenv('FLASK_ENV') == 'development'
    
    print(f"🚀 Запуск сервера на порту {port}")
    if debug:
        print("📊 Откройте http://localhost:3000 в браузере")
    
    app.run(host='0.0.0.0', port=port, debug=debug)
