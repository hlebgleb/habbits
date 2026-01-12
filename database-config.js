// Конфигурация ID базы данных Notion
// Значения загружаются с сервера из переменных окружения
// Fallback значения для локальной разработки (если не используются переменные окружения)

const DATABASE_CONFIG = {
    // ID базы данных Notion для привычек
    // Загружается с сервера из переменной окружения DATABASE_ID
    DATABASE_ID: '2e5911c2c35f8043b1d1ee2658135eb3', // Fallback для локальной разработки
    
    // ID базы данных Notion для вопросов об энергии
    // Загружается с сервера из переменной окружения ENERGY_DATABASE_ID
    ENERGY_DATABASE_ID: null, // Будет загружено с сервера
};

// Загружаем конфигурацию с сервера при загрузке страницы
let configLoaded = false;
const configLoadPromise = (async function loadConfig() {
    try {
        const response = await fetch('/api/config');
        if (response.ok) {
            const config = await response.json();
            if (config.DATABASE_ID) {
                DATABASE_CONFIG.DATABASE_ID = config.DATABASE_ID;
            }
            if (config.ENERGY_DATABASE_ID) {
                DATABASE_CONFIG.ENERGY_DATABASE_ID = config.ENERGY_DATABASE_ID;
            }
            console.log('✅ Конфигурация загружена с сервера');
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
