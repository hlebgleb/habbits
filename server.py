#!/usr/bin/env python3
"""
Прокси-сервер для обхода CORS при работе с Notion API
"""

from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
import os
import sys

app = Flask(__name__, static_folder='.')
CORS(app)

# Загружаем конфигурацию из переменных окружения
NOTION_TOKEN = os.getenv('NOTION_TOKEN')
DATABASE_ID = os.getenv('DATABASE_ID')
ENERGY_DATABASE_ID = os.getenv('ENERGY_DATABASE_ID', '')  # Опционально
ENERGY_DATA_SOURCE_ID = os.getenv('ENERGY_DATA_SOURCE_ID', '')  # Опционально

if not NOTION_TOKEN or not DATABASE_ID:
    print("❌ Ошибка: Не установлены переменные окружения NOTION_TOKEN и DATABASE_ID")
    print("   Установите их в настройках Render или через .env файл")
    sys.exit(1)

NOTION_API_VERSION = '2025-09-03'  # Версия с поддержкой multi-source databases
NOTION_API_BASE = 'https://api.notion.com/v1'

@app.route('/')
def index():
    """Главная страница"""
    return send_from_directory('.', 'index.html')

@app.route('/api/config')
def get_config():
    """Получить конфигурацию для клиента"""
    return jsonify({
        'DATABASE_ID': DATABASE_ID,
        'ENERGY_DATABASE_ID': ENERGY_DATABASE_ID or None,
        'ENERGY_DATA_SOURCE_ID': ENERGY_DATA_SOURCE_ID or None
    })

@app.route('/<path:path>')
def static_files(path):
    """Статические файлы"""
    return send_from_directory('.', path)

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
