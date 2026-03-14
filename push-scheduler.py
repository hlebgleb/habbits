#!/usr/bin/env python3
"""
Планировщик push-уведомлений
Отправляет напоминания в 23:00 по московскому времени
"""

import os
import sys
import json
import time
from pathlib import Path
from datetime import datetime
import pytz

try:
    from pywebpush import webpush, WebPushException
except ImportError:
    print("❌ pywebpush не установлен. Запустите: pip install pywebpush")
    sys.exit(1)

try:
    from apscheduler.schedulers.blocking import BlockingScheduler
    from apscheduler.triggers.cron import CronTrigger
except ImportError:
    print("❌ apscheduler не установлен. Запустите: pip install apscheduler")
    sys.exit(1)

# Конфигурация - путь для хранения подписок (используем /app/data в Docker)
if os.path.exists('/app/data'):
    SUBSCRIPTIONS_FILE = Path('/app/data/push_subscriptions.json')
elif os.path.exists('/opt/habbits'):
    SUBSCRIPTIONS_FILE = Path('/opt/habbits/push_subscriptions.json')
else:
    SUBSCRIPTIONS_FILE = Path('push_subscriptions.json')
VAPID_PRIVATE_KEY = os.getenv('VAPID_PRIVATE_KEY', '')
VAPID_PUBLIC_KEY = os.getenv('VAPID_PUBLIC_KEY', '')
VAPID_CLAIMS = {
    "sub": "mailto:gleb@hlebgleb.ru"
}

# Таймзона
MOSCOW_TZ = pytz.timezone('Europe/Moscow')


def load_subscriptions():
    """Загрузить подписки из файла"""
    if SUBSCRIPTIONS_FILE.exists():
        try:
            with open(SUBSCRIPTIONS_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"❌ Ошибка загрузки подписок: {e}")
            return {}
    return {}


def save_subscriptions(subscriptions):
    """Сохранить подписки в файл"""
    with open(SUBSCRIPTIONS_FILE, 'w') as f:
        json.dump(subscriptions, f, indent=2)


def send_notification(user, message):
    """Отправить push-уведомление пользователю"""
    if not VAPID_PRIVATE_KEY:
        print("❌ VAPID_PRIVATE_KEY не настроен")
        return 0, 0
    
    subscriptions = load_subscriptions()
    user_subs = subscriptions.get(user, [])
    
    if not user_subs:
        print(f"ℹ️ Нет подписок для пользователя {user}")
        return 0, 0
    
    payload = json.dumps({
        'title': 'Трекер Привычек 📊',
        'body': message,
        'icon': '/icons/icon.svg',
        'badge': '/icons/icon.svg',
        'tag': 'habits-reminder',
        'data': {'url': f'/{user}'}
    })
    
    sent = 0
    failed = 0
    invalid_endpoints = []
    
    for sub in user_subs:
        try:
            webpush(
                subscription_info=sub,
                data=payload,
                vapid_private_key=VAPID_PRIVATE_KEY,
                vapid_claims=VAPID_CLAIMS
            )
            sent += 1
            print(f"✅ Push отправлен для {user}")
        except WebPushException as e:
            print(f"❌ Ошибка отправки push для {user}: {e}")
            failed += 1
            # Если подписка невалидна (устройство отписалось), помечаем для удаления
            if e.response is not None and e.response.status_code in [404, 410]:
                invalid_endpoints.append(sub.get('endpoint'))
    
    # Удаляем невалидные подписки
    if invalid_endpoints:
        subscriptions[user] = [s for s in subscriptions[user] if s.get('endpoint') not in invalid_endpoints]
        save_subscriptions(subscriptions)
        print(f"🗑️ Удалено {len(invalid_endpoints)} невалидных подписок")
    
    return sent, failed


def send_daily_reminder():
    """Отправить ежедневное напоминание всем пользователям"""
    now = datetime.now(MOSCOW_TZ)
    print(f"\n{'='*50}")
    print(f"🔔 Отправка напоминаний в {now.strftime('%H:%M %d.%m.%Y')} MSK")
    print(f"{'='*50}")
    
    subscriptions = load_subscriptions()
    
    messages = {
        'gleb': 'Привет! Не забудь отметить привычки за сегодня 💪',
        'dasha': 'Привет! Пора отметить привычки за сегодня ✨'
    }
    
    total_sent = 0
    total_failed = 0
    
    for user in subscriptions.keys():
        message = messages.get(user, 'Не забудь отметить привычки!')
        sent, failed = send_notification(user, message)
        total_sent += sent
        total_failed += failed
    
    print(f"\n📊 Итого: отправлено {total_sent}, ошибок {total_failed}")


def main():
    """Запуск планировщика"""
    print("🚀 Запуск планировщика push-уведомлений")
    print(f"📁 Файл подписок: {SUBSCRIPTIONS_FILE}")
    print(f"🔑 VAPID ключ: {'настроен' if VAPID_PRIVATE_KEY else 'НЕ НАСТРОЕН'}")
    
    if not VAPID_PRIVATE_KEY:
        print("\n❌ VAPID_PRIVATE_KEY не установлен!")
        print("Установите переменную окружения VAPID_PRIVATE_KEY")
        print("\nДля генерации ключей выполните:")
        print("  python generate-vapid-keys.py")
        sys.exit(1)
    
    scheduler = BlockingScheduler(timezone=MOSCOW_TZ)
    
    # Ежедневно в 23:00 по Москве
    scheduler.add_job(
        send_daily_reminder,
        CronTrigger(hour=23, minute=0, timezone=MOSCOW_TZ),
        id='daily_reminder',
        name='Ежедневное напоминание в 23:00'
    )
    
    print(f"\n⏰ Напоминания будут отправляться в 23:00 MSK")
    print("Нажмите Ctrl+C для остановки\n")
    
    # Для отладки: отправить сразу
    if '--test' in sys.argv:
        print("🧪 Тестовая отправка...")
        send_daily_reminder()
        return
    
    try:
        scheduler.start()
    except (KeyboardInterrupt, SystemExit):
        print("\n👋 Планировщик остановлен")


if __name__ == '__main__':
    main()
