// Основное приложение

// Статичный список привычек с категориями
const HABITS_BY_CATEGORY = {
    'Foundation & Health': [
        'Daily',
        'Healthy food',
        'Workouts',
        'Doomscroll < 30m',
        'Go outside'
    ],
    'Craft & Outs / Create': [
        'Deep work sessions',
        'Outs this week'
    ],
    'Learn & Grow / Explore': [
        'Learning sessions',
        'Inner work'
    ],
    'Connections / People': [
        'Family call',
        'Friday date',
        'Offline go out',
        'Tier 2-4 reaching out'
    ]
};

let habitsState = {};

// Привычки с каунтером (вместо тумблера)
const COUNTER_HABITS = ['Deep work sessions', 'Learning sessions'];

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
    
    updateCurrentDate();
    initializeHabits();
    renderHabits();
});

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
    for (const [category, habits] of Object.entries(HABITS_BY_CATEGORY)) {
        for (const habit of habits) {
            const key = `${category}::${habit}`;
            // Для привычек с каунтером используем 0, для остальных false
            habitsState[key] = COUNTER_HABITS.includes(habit) ? 0 : false;
        }
    }
}

/**
 * Отобразить привычки на странице
 */
function renderHabits() {
    const container = document.getElementById('habitsContainer');
    const loading = document.getElementById('loading');
    loading.style.display = 'none';

    let html = '';

    // Рендерим категории и привычки
    for (const [category, habits] of Object.entries(HABITS_BY_CATEGORY)) {
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
        
        await Promise.all(promises);
        
        const completedCount = allHabits.filter(h => h.completed).length;
        const totalCount = allHabits.length;
        
        console.log(`✅ Отправлено ${totalCount} привычек в Notion (${completedCount} выполнено)`);
        
        // Показываем popup с успешным сообщением
        showSuccessPopup(totalCount, completedCount);
        
        // Сбрасываем состояние после закрытия popup
        setTimeout(() => {
            initializeHabits();
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
        'workouts': '💪',
        'doomscroll': '📱',
        'go outside': '🌳',
        'deep work': '🎯',
        'outs': '📝',
        'learning': '📚',
        'inner work': '🧘',
        'family': '👨‍👩‍👧‍👦',
        'date': '💑',
        'offline': '🎉',
        'reaching out': '💬',
    };

    const lowerName = habitName.toLowerCase();
    for (const [key, emoji] of Object.entries(emojiMap)) {
        if (lowerName.includes(key)) {
            return emoji;
        }
    }

    return '✅'; // Дефолтный эмодзи
}
