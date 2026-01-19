#!/usr/bin/env python3
"""
Генератор VAPID ключей для push-уведомлений
Запустите один раз и сохраните ключи в переменные окружения
"""

try:
    from cryptography.hazmat.primitives.asymmetric import ec
    from cryptography.hazmat.backends import default_backend
    import base64
except ImportError:
    print("❌ Установите cryptography: pip install cryptography")
    exit(1)

def generate_vapid_keys():
    """Генерирует пару VAPID ключей"""
    # Генерируем приватный ключ
    private_key = ec.generate_private_key(ec.SECP256R1(), default_backend())
    
    # Получаем числа
    private_numbers = private_key.private_numbers()
    public_numbers = private_key.public_key().public_numbers()
    
    # Кодируем приватный ключ (32 байта)
    private_bytes = private_numbers.private_value.to_bytes(32, 'big')
    private_b64 = base64.urlsafe_b64encode(private_bytes).decode('utf-8').rstrip('=')
    
    # Кодируем публичный ключ (65 байт: 0x04 + x + y)
    public_bytes = b'\x04' + public_numbers.x.to_bytes(32, 'big') + public_numbers.y.to_bytes(32, 'big')
    public_b64 = base64.urlsafe_b64encode(public_bytes).decode('utf-8').rstrip('=')
    
    return private_b64, public_b64


if __name__ == '__main__':
    private_key, public_key = generate_vapid_keys()
    
    print("=" * 60)
    print("🔑 VAPID ключи для push-уведомлений")
    print("=" * 60)
    print()
    print("Добавьте эти переменные окружения на сервер:")
    print()
    print(f"VAPID_PRIVATE_KEY={private_key}")
    print()
    print(f"VAPID_PUBLIC_KEY={public_key}")
    print()
    print("=" * 60)
    print()
    print("Для Docker (.env файл):")
    print(f'VAPID_PRIVATE_KEY="{private_key}"')
    print(f'VAPID_PUBLIC_KEY="{public_key}"')
