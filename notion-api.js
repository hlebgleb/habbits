// Утилиты для работы с Notion API

const NOTION_API_VERSION = '2025-09-03'; // Версия с поддержкой multi-source databases
// Используем локальный прокси-сервер для обхода CORS
const API_PROXY_BASE = '/api/notion';

// Кэш для data_source_id
let cachedDataSourceId = null;
let cachedEnergyDataSourceId = null;

// Кэш для схемы базы данных энергии (названия полей)
let cachedEnergyDatabaseSchema = null;

/**
 * Запрос к Notion API через прокси-сервер
 */
async function notionRequest(endpoint, method = 'GET', body = null) {
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
 * @param {string} databaseId - ID базы данных (опционально, по умолчанию DATABASE_ID)
 */
async function getDataSourceId(databaseId = null) {
    const targetDatabaseId = databaseId || DATABASE_CONFIG.DATABASE_ID;
    const isEnergyDb = databaseId === DATABASE_CONFIG.ENERGY_DATABASE_ID;
    
    // Используем кэш, если уже получили
    if (isEnergyDb && cachedEnergyDataSourceId) {
        return cachedEnergyDataSourceId;
    }
    if (!isEnergyDb && cachedDataSourceId) {
        return cachedDataSourceId;
    }

    try {
        // Получаем информацию о базе данных с версией 2025-09-03
        const endpoint = `/databases/${targetDatabaseId}`;
        const response = await notionRequest(endpoint, 'GET');
        
        // Извлекаем первый data_source_id (для простых баз данных обычно один)
        if (response.data_sources && response.data_sources.length > 0) {
            const dataSourceId = response.data_sources[0].id;
            if (isEnergyDb) {
                cachedEnergyDataSourceId = dataSourceId;
            } else {
                cachedDataSourceId = dataSourceId;
            }
            console.log(`✅ Получен data_source_id: ${dataSourceId}`);
            return dataSourceId;
        } else {
            throw new Error('База данных не содержит data sources');
        }
    } catch (error) {
        console.error('Ошибка получения data_source_id:', error);
        throw new Error(`Не удалось получить data_source_id: ${error.message}`);
    }
}

/**
 * Получить data_source_id для базы данных энергии
 * Если ENERGY_DATA_SOURCE_ID задан в конфиге, используем его
 * Иначе получаем из database
 */
async function getEnergyDataSourceId() {
    if (!DATABASE_CONFIG.ENERGY_DATABASE_ID) {
        throw new Error('ENERGY_DATABASE_ID не настроен');
    }
    
    // Если DATA_SOURCE_ID задан в конфиге, используем его
    if (DATABASE_CONFIG.ENERGY_DATA_SOURCE_ID) {
        return DATABASE_CONFIG.ENERGY_DATA_SOURCE_ID;
    }
    
    // Иначе получаем из database
    return await getDataSourceId(DATABASE_CONFIG.ENERGY_DATABASE_ID);
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
    const endpoint = `/databases/${DATABASE_CONFIG.DATABASE_ID}`;
    return await notionRequest(endpoint);
}

/**
 * Получить схему базы данных энергии и определить названия полей
 * Согласно новой версии Notion API, properties находятся в data_source, а не в database
 */
async function getEnergyDatabaseSchema() {
    if (cachedEnergyDatabaseSchema) {
        return cachedEnergyDatabaseSchema;
    }

    if (!DATABASE_CONFIG.ENERGY_DATABASE_ID) {
        throw new Error('ENERGY_DATABASE_ID не настроен');
    }

    try {
        // Шаг 1: Получаем database для получения data_sources
        const dbEndpoint = `/databases/${DATABASE_CONFIG.ENERGY_DATABASE_ID}`;
        const dbResponse = await notionRequest(dbEndpoint, 'GET');
        
        console.log('🔍 Ответ database:', JSON.stringify(dbResponse, null, 2));
        
        // Шаг 2: Получаем data_source_id
        let dataSourceId = null;
        
        // Если DATA_SOURCE_ID задан в конфиге, используем его
        if (DATABASE_CONFIG.ENERGY_DATA_SOURCE_ID) {
            dataSourceId = DATABASE_CONFIG.ENERGY_DATA_SOURCE_ID;
            console.log('✅ Используем ENERGY_DATA_SOURCE_ID из конфига:', dataSourceId);
        } else if (dbResponse.data_sources && dbResponse.data_sources.length > 0) {
            // Иначе берем первый data_source из database
            dataSourceId = dbResponse.data_sources[0].id;
            console.log('✅ Получен data_source_id из database:', dataSourceId);
        } else {
            throw new Error('У database нет data_sources. Убедитесь, что база данных создана правильно.');
        }
        
        // Шаг 3: Получаем data_source для получения properties
        const dsEndpoint = `/data_sources/${dataSourceId}`;
        const dsResponse = await notionRequest(dsEndpoint, 'GET');
        
        console.log('🔍 Ответ data_source:', JSON.stringify(dsResponse, null, 2));
        
        // Шаг 4: Извлекаем properties из data_source
        const properties = dsResponse.properties || {};
        
        const propertyKeys = Object.keys(properties);
        console.log('ℹ️ Поля базы данных энергии:', propertyKeys);
        console.log('ℹ️ Детали полей:', properties);
        const schema = {
            questionField: null, // Поле для вопроса (Title)
            dateField: null,     // Поле для даты (Date)
            answerField: null    // Поле для ответа (Select)
        };

        // Ищем поля по типу и возможным названиям
        for (const [fieldName, fieldInfo] of Object.entries(properties)) {
            const fieldType = fieldInfo.type;
            
            // Ищем поле для вопроса (Title)
            if (fieldType === 'title' && !schema.questionField) {
                // Проверяем возможные названия
                const lowerName = fieldName.toLowerCase();
                if (lowerName.includes('вопрос') || lowerName.includes('question') || lowerName === 'name') {
                    schema.questionField = fieldName;
                }
            }
            
            // Ищем поле для даты (Date)
            if (fieldType === 'date' && !schema.dateField) {
                const lowerName = fieldName.toLowerCase();
                if (lowerName.includes('дата') || lowerName.includes('date')) {
                    schema.dateField = fieldName;
                }
            }
            
            // Ищем поле для ответа (Select)
            if (fieldType === 'select' && !schema.answerField) {
                const lowerName = fieldName.toLowerCase();
                if (lowerName.includes('ответ') || lowerName.includes('answer')) {
                    schema.answerField = fieldName;
                }
            }
        }

        // Если не нашли по названиям, берем первые поля нужных типов
        if (!schema.questionField) {
            for (const [fieldName, fieldInfo] of Object.entries(properties)) {
                if (fieldInfo.type === 'title') {
                    schema.questionField = fieldName;
                    break;
                }
            }
        }

        if (!schema.dateField) {
            for (const [fieldName, fieldInfo] of Object.entries(properties)) {
                if (fieldInfo.type === 'date') {
                    schema.dateField = fieldName;
                    break;
                }
            }
        }

        if (!schema.answerField) {
            for (const [fieldName, fieldInfo] of Object.entries(properties)) {
                if (fieldInfo.type === 'select') {
                    schema.answerField = fieldName;
                    break;
                }
            }
        }

        cachedEnergyDatabaseSchema = schema;
        console.log('✅ Схема базы данных энергии:', schema);
        if (!schema.questionField || !schema.dateField || !schema.answerField) {
            throw new Error(
                `Не удалось определить все необходимые поля. Доступные поля: ${propertyKeys.join(
                    ', '
                ) || 'нет полей'}.`
            );
        }
        return schema;
    } catch (error) {
        console.error('Ошибка получения схемы базы данных энергии:', error);
        throw new Error(`Не удалось получить схему базы данных: ${error.message}`);
    }
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

/**
 * Создать запись об уровне энергии в Notion
 * @param {string} question - Текст вопроса
 * @param {string} answer - Выбранный ответ
 * @param {string} date - Дата в формате YYYY-MM-DD (по умолчанию сегодня)
 */
async function createEnergyRecord(question, answer, date = null) {
    if (!date) {
        date = new Date().toISOString().split('T')[0];
    }

    if (!DATABASE_CONFIG.ENERGY_DATABASE_ID) {
        throw new Error('ENERGY_DATABASE_ID не настроен. Добавьте переменную окружения ENERGY_DATABASE_ID на сервере (Render) или в .env файл.');
    }

    // Получаем схему базы данных для определения правильных названий полей
    const schema = await getEnergyDatabaseSchema();
    
    if (!schema.questionField || !schema.dateField || !schema.answerField) {
        throw new Error(`Не удалось определить все необходимые поля в базе данных. Найдены: вопрос="${schema.questionField}", дата="${schema.dateField}", ответ="${schema.answerField}". Убедитесь, что в базе данных есть поля типа Title, Date и Select.`);
    }

    // Получаем data_source_id для базы данных энергии
    const dataSourceId = await getEnergyDataSourceId();

    // Создаем новую запись с правильными названиями полей
    const endpoint = '/pages';
    const properties = {
        [schema.questionField]: {
            title: [
                {
                    text: {
                        content: question,
                    },
                },
            ],
        },
        [schema.dateField]: {
            date: {
                start: date,
            },
        },
        [schema.answerField]: {
            select: {
                name: answer,
            },
        },
    };

    return await notionRequest(endpoint, 'POST', {
        parent: {
            type: 'data_source_id',
            data_source_id: dataSourceId,
        },
        properties: properties,
    });
}
