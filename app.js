// Основное приложение

// Статичный список привычек с категориями для Глеба
const GLEB_HABITS_BY_CATEGORY = {
    'H&B': [
        'Healthy food',
        'Cold shower',
        'Doomscroll < 30m',
        'Go outside'
    ],
    'W&SD': [
        'Daily',
        'Deep work sessions'
    ],
    'R&J': [
        'Family call',
        'Friday date',
        'Offline go out',
        'Tier 2-4 reaching out'
    ]
};

// Список привычек для Даши (без категорий, просто список)
const DASHA_HABITS = [
    'Спорт',
    'Книжка',
    'Режим сна, до 11',
    'Прогулка',
    'Благодарность дня',
    'Без сахара',
    'Без алкоголя',
    'Без мигрени'
];

// Получить список привычек в зависимости от пользователя
function getHabitsByCategory() {
    const user = DATABASE_CONFIG.USER || 'gleb';
    if (user === 'dasha') {
        // Для Даши возвращаем простую структуру с одной категорией
        return {
            'Привычки': DASHA_HABITS
        };
    }
    return GLEB_HABITS_BY_CATEGORY;
}

let habitsState = {};
let energyLevel = null; // Выбранный уровень энергии

// Привычки с каунтером (вместо тумблера)
const COUNTER_HABITS = ['Deep work sessions'];

// Варианты ответа для вопроса об энергии
// ВАЖНО: Названия должны точно совпадать с вариантами в Notion Select поле
const ENERGY_LEVELS = [
    { value: 1, label: 'Выжат апатия' }, // Без запятой, как в Notion
    { value: 2, label: 'Тяжело' },
    { value: 3, label: 'Норм' },
    { value: 4, label: 'Хорошо' },
    { value: 5, label: 'Очень хорошо' }
];

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    // Проверка, что страница открыта через HTTP, а не file://
    if (window.location.protocol === 'file:') {
        const container = document.getElementById('habitsContainer');
        container.innerHTML = `
            <div class="error-message" style="display: block; padding: 30px; text-align: center;">
                <h2 style="margin-bottom: 15px;">⚠️ Неправильный способ открытия</h2>
                <p style="margin-bottom: 10px;">Эта страница должна открываться через HTTP сервер, а не напрямую как файл.</p>
                <p style="margin-bottom: 20px;"><strong>Запустите сервер:</strong></p>
                <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0; border-radius: 5px;">
                    python3 server.py
                </code>
                <p style="margin-top: 20px;">Затем откройте в браузере:</p>
                <code style="background: #f0f0f0; padding: 10px; display: block; margin: 10px 0; border-radius: 5px;">
                    <a href="http://localhost:3000" style="color: #667eea; text-decoration: none;">http://localhost:3000</a>
                </code>
            </div>
        `;
        return;
    }
    
    // Ждем загрузки конфигурации с сервера
    await waitForConfig();
    
    updateCurrentDate();
    initializeHabits();
    initializeEnergyQuestion();
    renderHabits();
    
    // Инициализация push-уведомлений
    if (typeof createNotificationButton === 'function') {
        createNotificationButton('notificationSection');
    }
    
    // Ссылка на статистику только для Глеба
    const user = DATABASE_CONFIG.USER || 'gleb';
    if (user === 'gleb') {
        const statLinkSection = document.getElementById('statLinkSection');
        if (statLinkSection) {
            statLinkSection.innerHTML = '<a href="/gleb/stat" class="stat-link">📊 Посмотреть статистику за неделю</a>';
        }
    }
    
    // Разные фавиконки для разных пользователей
    setUserFavicon(user);
});

/**
 * Установить фавиконку в зависимости от пользователя
 */
function setUserFavicon(user) {
    const emoji = user === 'dasha' ? '🌸' : '💪';
    const favicon = document.querySelector('link[rel="icon"]');
    if (favicon) {
        favicon.href = `data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2290%22>${emoji}</text></svg>`;
    }
    
    // Также обновляем title страницы
    document.title = user === 'dasha' ? 'Привычки Даши' : 'Трекер Привычек';
}

/**
 * Обновить отображение текущей даты
 */
function updateCurrentDate() {
    const dateElement = document.getElementById('currentDate');
    const today = new Date();
    const options = { 
        weekday: 'long', 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
    };
    dateElement.textContent = today.toLocaleDateString('ru-RU', options);
}

/**
 * Инициализировать состояние привычек (все выключены по умолчанию, каунтеры = 0)
 */
function initializeHabits() {
    habitsState = {};
    const habitsByCategory = getHabitsByCategory();
    for (const [category, habits] of Object.entries(habitsByCategory)) {
        for (const habit of habits) {
            const key = `${category}::${habit}`;
            // Для привычек с каунтером используем 0, для остальных false
            habitsState[key] = COUNTER_HABITS.includes(habit) ? 0 : false;
        }
    }
}

/**
 * Инициализировать вопрос об энергии
 */
function initializeEnergyQuestion() {
    energyLevel = null;
}

/**
 * Отобразить привычки на странице
 */
function renderHabits() {
    const container = document.getElementById('habitsContainer');
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = 'none';
    }

    let html = '';
    const habitsByCategory = getHabitsByCategory();
    const user = DATABASE_CONFIG.USER || 'gleb';
    const showEnergyQuestion = user === 'gleb';

    // Рендерим категории и привычки
    for (const [category, habits] of Object.entries(habitsByCategory)) {
        html += `<div class="category-section">`;
        html += `<h2 class="category-title">${category}</h2>`;
        
        for (const habit of habits) {
            const key = `${category}::${habit}`;
            const emoji = getHabitEmoji(habit);
            const isCounter = COUNTER_HABITS.includes(habit);
            const value = habitsState[key] || (isCounter ? 0 : false);
            
            if (isCounter) {
                // Каунтер для привычек с множественными сессиями
                html += `
                    <div class="habit-item ${value > 0 ? 'completed' : ''}" data-key="${key}">
                        <div class="habit-info">
                            <span class="habit-emoji">${emoji}</span>
                            <span class="habit-name">${habit}</span>
                        </div>
                        <div class="counter-controls">
                            <button class="counter-button" onclick="decrementCounter('${key}')">−</button>
                            <span class="counter-value">${value}</span>
                            <button class="counter-button" onclick="incrementCounter('${key}')">+</button>
                        </div>
                    </div>
                `;
            } else {
                // Тумблер для обычных привычек
                const isChecked = value === true;
                html += `
                    <div class="habit-item ${isChecked ? 'completed' : ''}" data-key="${key}">
                        <div class="habit-info">
                            <span class="habit-emoji">${emoji}</span>
                            <span class="habit-name">${habit}</span>
                        </div>
                        <label class="toggle-switch">
                            <input 
                                type="checkbox" 
                                ${isChecked ? 'checked' : ''}
                                onchange="toggleHabit('${key}')"
                            >
                            <span class="toggle-slider"></span>
                        </label>
                    </div>
                `;
            }
        }
        
        html += `</div>`;
    }

    // Добавляем вопрос об энергии только для Глеба
    if (showEnergyQuestion) {
        html += `
            <div class="energy-question-section">
                <h2 class="category-title">💡 Вопрос дня</h2>
                <div class="energy-question-item">
                    <div class="energy-question-text">
                        <span class="energy-question-label">Какой мой уровень энергии и интереса к жизни сегодня?</span>
                    </div>
                    <div class="energy-options">
                        ${ENERGY_LEVELS.map(level => `
                            <label class="energy-option ${energyLevel === level.value ? 'selected' : ''}">
                                <input 
                                    type="radio" 
                                    name="energyLevel" 
                                    value="${level.value}"
                                    ${energyLevel === level.value ? 'checked' : ''}
                                    onchange="selectEnergyLevel(${level.value})"
                                >
                                <span class="energy-option-label">${level.value}. ${level.label}</span>
                            </label>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    // Добавляем кнопку отправки внизу
    html += `
        <div class="submit-section">
            <button id="submitButton" class="submit-button" onclick="submitHabits()">
                Отправить
            </button>
        </div>
    `;

    container.innerHTML = html;
}

/**
 * Переключить статус привычки (для тумблеров)
 */
function toggleHabit(key) {
    const checkbox = document.querySelector(`[data-key="${key}"] input[type="checkbox"]`);
    habitsState[key] = checkbox.checked;
    
    // Обновляем визуальное состояние
    const habitItem = document.querySelector(`[data-key="${key}"]`);
    habitItem.classList.toggle('completed', checkbox.checked);
}

/**
 * Увеличить каунтер
 */
function incrementCounter(key) {
    const currentValue = habitsState[key] || 0;
    habitsState[key] = currentValue + 1;
    
    // Обновляем отображение
    const counterValue = document.querySelector(`[data-key="${key}"] .counter-value`);
    if (counterValue) {
        counterValue.textContent = habitsState[key];
    }
    
    // Обновляем визуальное состояние
    const habitItem = document.querySelector(`[data-key="${key}"]`);
    if (habitItem) {
        habitItem.classList.toggle('completed', habitsState[key] > 0);
    }
}

/**
 * Уменьшить каунтер (не ниже 0)
 */
function decrementCounter(key) {
    const currentValue = habitsState[key] || 0;
    if (currentValue > 0) {
        habitsState[key] = currentValue - 1;
        
        // Обновляем отображение
        const counterValue = document.querySelector(`[data-key="${key}"] .counter-value`);
        if (counterValue) {
            counterValue.textContent = habitsState[key];
        }
        
        // Обновляем визуальное состояние
        const habitItem = document.querySelector(`[data-key="${key}"]`);
        if (habitItem) {
            habitItem.classList.toggle('completed', habitsState[key] > 0);
        }
    }
}

/**
 * Выбрать уровень энергии
 */
function selectEnergyLevel(value) {
    energyLevel = value;
    
    // Обновляем визуальное состояние
    document.querySelectorAll('.energy-option').forEach(option => {
        option.classList.remove('selected');
    });
    
    const selectedOption = document.querySelector(`input[value="${value}"]`)?.closest('.energy-option');
    if (selectedOption) {
        selectedOption.classList.add('selected');
    }
}

/**
 * Отправить все привычки в Notion (включенные и выключенные)
 */
async function submitHabits() {
    const submitButton = document.getElementById('submitButton');
    const errorMessage = document.getElementById('errorMessage');
    
    // Получаем все привычки с их статусом
    const allHabits = [];
    for (const [key, value] of Object.entries(habitsState)) {
        const [, habitName] = key.split('::');
        const isCounter = COUNTER_HABITS.includes(habitName);
        
        if (isCounter) {
            // Для каунтера: количество записей = значению каунтера
            const count = value || 0;
            for (let i = 0; i < count; i++) {
                allHabits.push({
                    name: habitName,
                    completed: true
                });
            }
        } else {
            // Для тумблера: одна запись с completed = true/false
            allHabits.push({
                name: habitName,
                completed: value === true
            });
        }
    }

    // Блокируем кнопку
    submitButton.disabled = true;
    submitButton.textContent = 'Отправка...';
    errorMessage.style.display = 'none';

    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Отправляем все привычки
        const promises = allHabits.map(habit => 
            createHabitRecord(habit.name, habit.completed, today)
        );
        
        // Отправляем ответ на вопрос об энергии, если выбран (только для Глеба)
        const user = DATABASE_CONFIG.USER || 'gleb';
        if (user === 'gleb' && energyLevel !== null) {
            const selectedLevel = ENERGY_LEVELS.find(level => level.value === energyLevel);
            promises.push(
                createEnergyRecord(
                    'Какой мой уровень энергии и интереса к жизни сегодня?',
                    selectedLevel.label,
                    today
                )
            );
        }
        
        await Promise.all(promises);
        
        const completedCount = allHabits.filter(h => h.completed).length;
        const totalCount = allHabits.length;
        const energyCount = (user === 'gleb' && energyLevel !== null) ? 1 : 0;
        
        console.log(`✅ Отправлено ${totalCount} привычек и ${energyCount} ответов об энергии в Notion`);
        
        // Показываем popup с успешным сообщением
        showSuccessPopup(totalCount + energyCount, completedCount);
        
        // Сбрасываем состояние после закрытия popup
        setTimeout(() => {
            initializeHabits();
            initializeEnergyQuestion();
            renderHabits();
        }, 100);
        
    } catch (error) {
        console.error('Ошибка отправки привычек:', error);
        errorMessage.textContent = `Ошибка отправки: ${error.message}`;
        errorMessage.className = 'error-message';
        errorMessage.style.display = 'block';
    } finally {
        submitButton.disabled = false;
        submitButton.textContent = 'Отправить';
    }
}

/**
 * Показать popup с сообщением об успехе
 */
function showSuccessPopup(totalCount) {
    const popup = document.getElementById('successPopup');
    const popupMessage = document.getElementById('popupMessage');
    
    popupMessage.textContent = `Отправлено ${totalCount} записей в Notion`;
    
    popup.style.display = 'flex';
    
    // Закрытие по клику на overlay
    popup.onclick = function(event) {
        if (event.target === popup) {
            closeSuccessPopup();
        }
    };
    
    // Закрытие по Escape
    document.addEventListener('keydown', function escapeHandler(event) {
        if (event.key === 'Escape') {
            closeSuccessPopup();
            document.removeEventListener('keydown', escapeHandler);
        }
    });
}

/**
 * Закрыть popup
 */
function closeSuccessPopup() {
    const popup = document.getElementById('successPopup');
    popup.style.display = 'none';
}

/**
 * Получить эмодзи для привычки
 */
function getHabitEmoji(habitName) {
    const emojiMap = {
        'daily': '🌅',
        'healthy food': '🥗',
        'cold shower': '🚿',
        'doomscroll': '📱',
        'go outside': '🌳',
        'deep work': '🎯',
        'family': '👧',
        'date': '💑',
        'offline': '🎉',
        'reaching out': '💬',
        // Эмодзи для привычек Даши
        'спорт': '💪',
        'книжка': '📚',
        'книга': '📚',
        'режим сна': '😴',
        'сна': '😴',
        'прогулка': '🚶',
        'благодарность': '🙏',
        'без сахара': '🚫🍬',
        'сахар': '🚫🍬',
        'без алкоголя': '🚫🍷',
        'алкоголь': '🚫🍷',
        'без мигрени': '✅',
        'мигрень': '✅',
    };

    const lowerName = habitName.toLowerCase();
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (lowerName.includes(key)) {
            return emoji;
        }
    }

    return '✅'; // Дефолтный эмодзи
}
