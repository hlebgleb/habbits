// Push-уведомления для PWA

// VAPID public key (генерируется на сервере)
let VAPID_PUBLIC_KEY = null;

/**
 * Инициализация push-уведомлений
 */
async function initPushNotifications() {
    // Проверяем поддержку
    if (!('serviceWorker' in navigator)) {
        console.log('[Push] Service Worker не поддерживается');
        return false;
    }

    if (!('PushManager' in window)) {
        console.log('[Push] Push API не поддерживается');
        return false;
    }

    try {
        // Получаем VAPID ключ с сервера
        const response = await fetch('/api/push/vapid-key');
        const data = await response.json();
        VAPID_PUBLIC_KEY = data.publicKey;
        console.log('[Push] VAPID ключ получен');
        return true;
    } catch (error) {
        console.error('[Push] Ошибка получения VAPID ключа:', error);
        return false;
    }
}

/**
 * Регистрация Service Worker
 */
async function registerServiceWorker() {
    try {
        const registration = await navigator.serviceWorker.register('/service-worker.js');
        console.log('[Push] Service Worker зарегистрирован:', registration.scope);
        return registration;
    } catch (error) {
        console.error('[Push] Ошибка регистрации Service Worker:', error);
        return null;
    }
}

/**
 * Проверить статус подписки
 */
async function checkSubscriptionStatus() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        return subscription !== null;
    } catch (error) {
        console.error('[Push] Ошибка проверки подписки:', error);
        return false;
    }
}

/**
 * Запросить разрешение и подписаться на уведомления
 */
async function subscribeToPush() {
    try {
        // Запрашиваем разрешение
        const permission = await Notification.requestPermission();
        
        if (permission !== 'granted') {
            console.log('[Push] Разрешение не получено:', permission);
            return { success: false, reason: 'permission_denied' };
        }

        // Получаем registration
        const registration = await navigator.serviceWorker.ready;

        // Подписываемся на push
        const subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
        });

        console.log('[Push] Подписка создана:', subscription);

        // Отправляем подписку на сервер
        const user = DATABASE_CONFIG?.USER || 'gleb';
        const response = await fetch('/api/push/subscribe', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                subscription: subscription.toJSON(),
                user: user
            })
        });

        if (response.ok) {
            console.log('[Push] Подписка сохранена на сервере');
            return { success: true };
        } else {
            throw new Error('Ошибка сохранения подписки');
        }
    } catch (error) {
        console.error('[Push] Ошибка подписки:', error);
        return { success: false, reason: error.message };
    }
}

/**
 * Отписаться от уведомлений
 */
async function unsubscribeFromPush() {
    try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();

        if (subscription) {
            // Отписываемся локально
            await subscription.unsubscribe();

            // Удаляем с сервера
            const user = DATABASE_CONFIG?.USER || 'gleb';
            await fetch('/api/push/unsubscribe', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    endpoint: subscription.endpoint,
                    user: user
                })
            });

            console.log('[Push] Отписка выполнена');
            return true;
        }
        return false;
    } catch (error) {
        console.error('[Push] Ошибка отписки:', error);
        return false;
    }
}

/**
 * Конвертация VAPID ключа
 */
function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding)
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);

    for (let i = 0; i < rawData.length; ++i) {
        outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
}

/**
 * Проверить, установлено ли приложение как PWA
 */
function isPWAInstalled() {
    // Проверяем display-mode
    if (window.matchMedia('(display-mode: standalone)').matches) {
        return true;
    }
    // iOS Safari
    if (window.navigator.standalone === true) {
        return true;
    }
    return false;
}

/**
 * Показать UI для установки PWA (iOS)
 */
function showInstallInstructions() {
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    if (isIOS) {
        return `
            <div class="pwa-install-hint">
                <p>Чтобы получать уведомления на iOS:</p>
                <ol>
                    <li>Нажмите кнопку "Поделиться" <span style="font-size: 1.2em;">↑</span></li>
                    <li>Выберите "На экран Домой"</li>
                    <li>Откройте приложение с домашнего экрана</li>
                    <li>Включите уведомления</li>
                </ol>
            </div>
        `;
    }
    
    return '';
}

/**
 * Создать кнопку подписки на уведомления
 */
async function createNotificationButton(containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    // Инициализируем
    const supported = await initPushNotifications();
    
    if (!supported) {
        container.innerHTML = '<p class="push-unsupported">Уведомления не поддерживаются в этом браузере</p>';
        return;
    }

    // Регистрируем SW
    await registerServiceWorker();

    // Проверяем, установлено ли как PWA
    const installed = isPWAInstalled();
    
    if (!installed) {
        container.innerHTML = `
            <div class="push-section">
                <h3>🔔 Напоминания в 22:00</h3>
                ${showInstallInstructions()}
                <p class="push-note">После установки здесь появится кнопка включения уведомлений</p>
            </div>
        `;
        return;
    }

    // Проверяем статус подписки
    const isSubscribed = await checkSubscriptionStatus();

    updateNotificationUI(container, isSubscribed);
}

/**
 * Обновить UI кнопки уведомлений
 */
function updateNotificationUI(container, isSubscribed) {
    if (isSubscribed) {
        container.innerHTML = `
            <div class="push-section push-enabled">
                <h3>🔔 Уведомления включены</h3>
                <p>Вы будете получать напоминание каждый день в 22:00</p>
                <button class="push-button push-button-disable" onclick="handleUnsubscribe()">
                    Отключить уведомления
                </button>
            </div>
        `;
    } else {
        container.innerHTML = `
            <div class="push-section">
                <h3>🔔 Напоминания в 22:00</h3>
                <p>Получайте напоминание отметить привычки каждый вечер</p>
                <button class="push-button" onclick="handleSubscribe()">
                    Включить уведомления
                </button>
            </div>
        `;
    }
}

/**
 * Обработчик подписки
 */
async function handleSubscribe() {
    const button = document.querySelector('.push-button');
    if (button) {
        button.disabled = true;
        button.textContent = 'Подключение...';
    }

    const result = await subscribeToPush();

    if (result.success) {
        const container = document.getElementById('notificationSection');
        if (container) {
            updateNotificationUI(container, true);
        }
    } else {
        if (button) {
            button.disabled = false;
            button.textContent = 'Включить уведомления';
        }
        
        if (result.reason === 'permission_denied') {
            alert('Вы отклонили запрос на уведомления. Разрешите их в настройках браузера.');
        } else {
            alert('Не удалось включить уведомления: ' + result.reason);
        }
    }
}

/**
 * Обработчик отписки
 */
async function handleUnsubscribe() {
    const success = await unsubscribeFromPush();
    
    if (success) {
        const container = document.getElementById('notificationSection');
        if (container) {
            updateNotificationUI(container, false);
        }
    }
}
