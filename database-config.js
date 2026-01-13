// Конфигурация ID базы данных Notion
// Значения загружаются с сервера из переменных окружения
// Fallback значения для локальной разработки (если не используются переменные окружения)

const DATABASE_CONFIG = {
    // ID базы данных Notion для привычек
    // Загружается с сервера из переменной окружения DATABASE_ID или DASHA_DATABASE_ID
    DATABASE_ID: '2e5911c2c35f8043b1d1ee2658135eb3', // Fallback для локальной разработки
    
    // ID базы данных Notion для вопросов об энергии
    // Загружается с сервера из переменной окружения ENERGY_DATABASE_ID
    ENERGY_DATABASE_ID: null, // Будет загружено с сервера
    
    // ID data source для базы данных энергии
    // Загружается с сервера из переменной окружения ENERGY_DATA_SOURCE_ID
    // Если не указан, будет получен автоматически из database
    ENERGY_DATA_SOURCE_ID: null, // Будет загружено с сервера
    
    // Текущий пользователь
    USER: 'gleb', // Будет определен из URL
};

// Определяем пользователя из URL
function getCurrentUser() {
    const path = window.location.pathname;
    if (path.includes('/dasha')) {
        return 'dasha';
    }
    return 'gleb'; // По умолчанию
}

// Загружаем конфигурацию с сервера при загрузке страницы
let configLoaded = false;
let currentUser = getCurrentUser();
const configLoadPromise = (async function loadConfig() {
    try {
        const user = getCurrentUser();
        const response = await fetch(`/api/config?user=${user}`);
        if (response.ok) {
            const config = await response.json();
            if (config.DATABASE_ID) {
                DATABASE_CONFIG.DATABASE_ID = config.DATABASE_ID;
            }
            if (config.ENERGY_DATABASE_ID) {
                DATABASE_CONFIG.ENERGY_DATABASE_ID = config.ENERGY_DATABASE_ID;
            }
            if (config.ENERGY_DATA_SOURCE_ID) {
                DATABASE_CONFIG.ENERGY_DATA_SOURCE_ID = config.ENERGY_DATA_SOURCE_ID;
            }
            // Сохраняем информацию о пользователе
            DATABASE_CONFIG.USER = config.USER || user;
            currentUser = DATABASE_CONFIG.USER;
            console.log(`✅ Конфигурация загружена с сервера для пользователя: ${currentUser}`);
            configLoaded = true;
        }
    } catch (error) {
        console.warn('⚠️ Не удалось загрузить конфигурацию с сервера, используются значения по умолчанию:', error);
        configLoaded = true; // Продолжаем работу с fallback значениями
    }
})();

// Функция для ожидания загрузки конфигурации
async function waitForConfig() {
    await configLoadPromise;
    return DATABASE_CONFIG;
}
