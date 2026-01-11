// Утилиты для работы с Notion API

const NOTION_API_VERSION = '2025-09-03'; // Версия с поддержкой multi-source databases
// Используем локальный прокси-сервер для обхода CORS
const API_PROXY_BASE = '/api/notion';

// Кэш для data_source_id
let cachedDataSourceId = null;

/**
 * Запрос к Notion API через прокси-сервер
 */
async function notionRequest(endpoint, method = 'GET', body = null) {
    if (!CONFIG.NOTION_TOKEN || !CONFIG.DATABASE_ID) {
        throw new Error('Не настроены NOTION_TOKEN или DATABASE_ID в config.js');
    }

    const url = `${API_PROXY_BASE}${endpoint}`;
    const options = {
        method,
        headers: {
            'Content-Type': 'application/json',
        },
    };

    if (body) {
        options.body = JSON.stringify(body);
    }

    try {
        const response = await fetch(url, options);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Ошибка API: ${response.status}`);
        }

        return data;
    } catch (error) {
        console.error('Ошибка запроса к Notion:', error);
        throw error;
    }
}

/**
 * Получить data_source_id для базы данных
 * Согласно документации 2025-09-03, нужно сначала получить data_source_id
 */
async function getDataSourceId() {
    // Используем кэш, если уже получили
    if (cachedDataSourceId) {
        return cachedDataSourceId;
    }

    try {
        // Получаем информацию о базе данных с версией 2025-09-03
        const endpoint = `/databases/${CONFIG.DATABASE_ID}`;
        const response = await notionRequest(endpoint, 'GET');
        
        // Извлекаем первый data_source_id (для простых баз данных обычно один)
        if (response.data_sources && response.data_sources.length > 0) {
            cachedDataSourceId = response.data_sources[0].id;
            console.log(`✅ Получен data_source_id: ${cachedDataSourceId}`);
            return cachedDataSourceId;
        } else {
            throw new Error('База данных не содержит data sources');
        }
    } catch (error) {
        console.error('Ошибка получения data_source_id:', error);
        throw new Error(`Не удалось получить data_source_id: ${error.message}`);
    }
}

/**
 * Получить все привычки из базы данных на сегодня
 */
async function getHabits() {
    try {
        // Получаем data_source_id
        const dataSourceId = await getDataSourceId();
        
        // Используем новый endpoint для data sources согласно 2025-09-03
        const endpoint = `/data_sources/${dataSourceId}/query`;
        const today = new Date().toISOString().split('T')[0];
        
        // Пробуем с фильтром по дате
        let response;
        try {
            response = await notionRequest(endpoint, 'POST', {
                filter: {
                    property: 'Date',
                    date: {
                        equals: today,
                    },
                },
                page_size: 100,
            });
        } catch (error) {
            // Если фильтр не работает, получаем все записи и фильтруем на клиенте
            console.warn('Фильтр по дате не работает, получаем все записи:', error.message);
            response = await notionRequest(endpoint, 'POST', {
                page_size: 100,
            });
            
            // Фильтруем на клиенте
            if (response.results) {
                response.results = response.results.filter(page => {
                    const dateProperty = page.properties?.Date?.date;
                    if (dateProperty?.start) {
                        return dateProperty.start.startsWith(today);
                    }
                    return false;
                });
            }
        }

        return response.results || [];
    } catch (error) {
        console.error('Ошибка получения привычек:', error);
        return [];
    }
}

/**
 * Получить структуру базы данных (для понимания свойств)
 */
async function getDatabaseSchema() {
    const endpoint = `/databases/${CONFIG.DATABASE_ID}`;
    return await notionRequest(endpoint);
}

/**
 * Создать запись о привычке в Notion
 * @param {string} habitName - Название привычки
 * @param {boolean} completed - Выполнена ли привычка (по умолчанию true)
 * @param {string} date - Дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */
async function createHabitRecord(habitName, completed = true, date = null) {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    // Получаем data_source_id
    const dataSourceId = await getDataSourceId();

    // Создаем новую запись
    // Согласно 2025-09-03, используем data_source_id вместо database_id
    const endpoint = '/pages';
    return await notionRequest(endpoint, 'POST', {
        parent: {
            type: 'data_source_id',
            data_source_id: dataSourceId,
        },
        properties: {
            Habit: {
                title: [
                    {
                        text: {
                            content: habitName,
                        },
                    },
                ],
            },
            Date: {
                date: {
                    start: date,
                },
            },
            Completed: {
                checkbox: completed,
            },
        },
    });
}

/**
 * Создать или обновить запись о привычке
 * @param {string} habitName - Название привычки
 * @param {boolean} completed - Выполнена ли привычка
 * @param {string} date - Дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */
async function updateHabit(habitName, completed, date = null) {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    // Получаем data_source_id
    const dataSourceId = await getDataSourceId();

    // Сначала ищем существующую запись на эту дату
    // Используем новый endpoint для data sources
    const existingRecords = await notionRequest(
        `/data_sources/${dataSourceId}/query`,
        'POST',
        {
            filter: {
                and: [
                    {
                        property: 'Date',
                        date: {
                            equals: date,
                        },
                    },
                    {
                        property: 'Habit',
                        title: {
                            equals: habitName,
                        },
                    },
                ],
            },
        }
    );

    const pageId = existingRecords.results?.[0]?.id;

    if (pageId) {
        // Обновляем существующую запись
        const endpoint = `/pages/${pageId}`;
        return await notionRequest(endpoint, 'PATCH', {
            properties: {
                Completed: {
                    checkbox: completed,
                },
            },
        });
    } else {
        // Создаем новую запись
        // Согласно 2025-09-03, используем data_source_id вместо database_id
        const endpoint = '/pages';
        return await notionRequest(endpoint, 'POST', {
            parent: {
                type: 'data_source_id',
                data_source_id: dataSourceId,
            },
            properties: {
                Habit: {
                    title: [
                        {
                            text: {
                                content: habitName,
                            },
                        },
                    ],
                },
                Date: {
                    date: {
                        start: date,
                    },
                },
                Completed: {
                    checkbox: completed,
                },
            },
        });
    }
}

/**
 * Получить все уникальные привычки (для начальной загрузки)
 */
async function getAllHabitsList() {
    try {
        // Получаем data_source_id
        const dataSourceId = await getDataSourceId();
        
        // Используем новый endpoint для data sources согласно 2025-09-03
        const endpoint = `/data_sources/${dataSourceId}/query`;
        
        // Получаем все записи (можно ограничить период, но для простоты получаем все)
        const response = await notionRequest(endpoint, 'POST', {
            page_size: 100,
        });

        // Извлекаем уникальные названия привычек
        const habitsSet = new Set();
        if (response.results) {
            response.results.forEach(page => {
                const habitProperty = page.properties?.Habit;
                if (habitProperty?.title?.[0]?.plain_text) {
                    habitsSet.add(habitProperty.title[0].plain_text);
                }
            });
        }

        return Array.from(habitsSet);
    } catch (error) {
        console.error('Ошибка получения списка привычек:', error);
        return [];
    }
}
