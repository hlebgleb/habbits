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

# Загружаем конфигурацию
try:
    # Импортируем config.js как модуль (нужно будет переписать на Python)
    # Пока используем прямое чтение
    import json
    import re
    
    with open('config.js', 'r', encoding='utf-8') as f:
        config_content = f.read()
    
    # Извлекаем значения из config.js
    token_match = re.search(r"NOTION_TOKEN:\s*['\"]([^'\"]+)['\"]", config_content)
    db_id_match = re.search(r"DATABASE_ID:\s*['\"]([^'\"]+)['\"]", config_content)
    
    if not token_match or not db_id_match:
        print("❌ Ошибка: Не удалось найти NOTION_TOKEN или DATABASE_ID в config.js")
        sys.exit(1)
    
    NOTION_TOKEN = token_match.group(1)
    DATABASE_ID = db_id_match.group(1)
    
except Exception as e:
    print(f"❌ Ошибка загрузки конфигурации: {e}")
    sys.exit(1)

NOTION_API_VERSION = '2025-09-03'  # Версия с поддержкой multi-source databases
NOTION_API_BASE = 'https://api.notion.com/v1'

@app.route('/')
def index():
    """Главная страница"""
    return send_from_directory('.', 'index.html')

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
            return jsonify(response.json()), response.status_code
        
        return jsonify(response.json())
        
    except Exception as e:
        print(f"Ошибка прокси к Notion: {e}")
        return jsonify({'message': str(e)}), 500

if __name__ == '__main__':
    print("🚀 Запуск сервера на http://localhost:3000")
    print("📊 Откройте http://localhost:3000 в браузере")
    app.run(host='0.0.0.0', port=3000, debug=True)
