// Конфигурация ID базы данных Notion
// DATABASE_ID не является секретом и может быть в публичном репозитории
// Получите ID из URL базы данных в Notion

const DATABASE_CONFIG = {
    // ID базы данных Notion для привычек (из URL базы данных)
    // Пример URL: https://www.notion.so/your-workspace/DATABASE_ID?v=...
    DATABASE_ID: '2e5911c2c35f8043b1d1ee2658135eb3',
    
    // ID базы данных Notion для вопросов об энергии
    // Нужно создать новую базу данных в Notion с полями:
    // - Дата (Date)
    // - Вопрос (Title)
    // - Ответ (Select: "Выжат, апатия", "Тяжело", "Норм", "Хорошо", "Очень хорошо")
    ENERGY_DATABASE_ID: '', // Замените на ID вашей новой базы данных
};
