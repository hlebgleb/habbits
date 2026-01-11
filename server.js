const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));

// Загружаем конфигурацию
let CONFIG;
try {
    // В продакшене лучше использовать переменные окружения
    delete require.cache[require.resolve('./config.js')];
    CONFIG = require('./config.js').CONFIG;
} catch (error) {
    console.error('Ошибка загрузки конфигурации:', error.message);
    process.exit(1);
}

const NOTION_API_VERSION = '2022-06-28';
const NOTION_API_BASE = 'https://api.notion.com/v1';

/**
 * Прокси для запросов к Notion API
 */
app.post('/api/notion/*', async (req, res) => {
    try {
        const endpoint = req.path.replace('/api/notion', '');
        const url = `${NOTION_API_BASE}${endpoint}`;

        const response = await fetch(url, {
            method: req.method,
            headers: {
                'Authorization': `Bearer ${CONFIG.NOTION_TOKEN}`,
                'Notion-Version': NOTION_API_VERSION,
                'Content-Type': 'application/json',
            },
            body: req.body ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Ошибка прокси к Notion:', error);
        res.status(500).json({ 
            message: error.message || 'Внутренняя ошибка сервера' 
        });
    }
});

// GET запросы тоже поддерживаем
app.get('/api/notion/*', async (req, res) => {
    try {
        const endpoint = req.path.replace('/api/notion', '');
        const url = `${NOTION_API_BASE}${endpoint}`;

        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${CONFIG.NOTION_TOKEN}`,
                'Notion-Version': NOTION_API_VERSION,
                'Content-Type': 'application/json',
            },
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Ошибка прокси к Notion:', error);
        res.status(500).json({ 
            message: error.message || 'Внутренняя ошибка сервера' 
        });
    }
});

// PATCH запросы для обновления
app.patch('/api/notion/*', async (req, res) => {
    try {
        const endpoint = req.path.replace('/api/notion', '');
        const url = `${NOTION_API_BASE}${endpoint}`;

        const response = await fetch(url, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${CONFIG.NOTION_TOKEN}`,
                'Notion-Version': NOTION_API_VERSION,
                'Content-Type': 'application/json',
            },
            body: req.body ? JSON.stringify(req.body) : undefined,
        });

        const data = await response.json();

        if (!response.ok) {
            return res.status(response.status).json(data);
        }

        res.json(data);
    } catch (error) {
        console.error('Ошибка прокси к Notion:', error);
        res.status(500).json({ 
            message: error.message || 'Внутренняя ошибка сервера' 
        });
    }
});

app.listen(PORT, () => {
    console.log(`🚀 Сервер запущен на http://localhost:${PORT}`);
    console.log(`📊 Откройте http://localhost:${PORT} в браузере`);
});
