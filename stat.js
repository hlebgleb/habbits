// Логика страницы статистики

// Текущая выбранная неделя (понедельник)
let currentWeekStart = getMonday(new Date());

// Захардкоженные цели для привычек
const HABITS_GOALS = {
    'Foundation & Health': {
        'Daily': 5,
        'Healthy food': 7,
        'Workouts': 2,
        'Doomscroll < 30m': 7,
        'Go outside': 7
    },
    'Craft & Outs / Create': {
        'Deep work sessions': 5,
        'Outs this week': 2
    },
    'Learn & Grow / Explore': {
        'Learning sessions': 3,
        'Inner work': 1
    },
    'Connections / People': {
        'Family call': 1,
        'Friday date': 1,
        'Offline go out': 1,
        'Tier 2-4 reaching out': 2
    }
};

// Маппинг уровней энергии на числа
const ENERGY_MAPPING = {
    'выжат апатия': 1,
    'тяжело': 2,
    'норм': 3,
    'хорошо': 4,
    'очень хорошо': 5
};

// Инициализация при загрузке страницы
document.addEventListener('DOMContentLoaded', async () => {
    await waitForConfig();
    updateWeekDisplay();
});

/**
 * Получить понедельник для заданной даты
 */
function getMonday(date) {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    d.setDate(diff);
    d.setHours(0, 0, 0, 0);
    return d;
}

/**
 * Получить воскресенье для заданной недели
 */
function getSunday(mondayDate) {
    const sunday = new Date(mondayDate);
    sunday.setDate(mondayDate.getDate() + 6);
    return sunday;
}

/**
 * Форматировать дату в читаемый формат (12 января)
 */
function formatDateShort(date) {
    const months = [
        'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
        'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'
    ];
    return `${date.getDate()} ${months[date.getMonth()]}`;
}

/**
 * Обновить отображение выбранной недели
 */
function updateWeekDisplay() {
    const monday = currentWeekStart;
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    const weekDisplay = document.getElementById('weekDisplay');
    const weekHint = document.getElementById('weekHint');

    weekDisplay.textContent = `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;

    // Номер недели
    const weekNumber = getWeekNumber(monday);
    weekHint.textContent = `Неделя ${weekNumber}, ${monday.getFullYear()}`;
}

/**
 * Получить номер недели в году
 */
function getWeekNumber(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
}

/**
 * Перейти на предыдущую неделю
 */
function previousWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() - 7);
    updateWeekDisplay();
    hideResults();
}

/**
 * Перейти на следующую неделю
 */
function nextWeek() {
    currentWeekStart.setDate(currentWeekStart.getDate() + 7);
    updateWeekDisplay();
    hideResults();
}

/**
 * Скрыть результаты
 */
function hideResults() {
    document.getElementById('resultsSection').style.display = 'none';
    document.getElementById('errorMessage').style.display = 'none';
}

/**
 * Рассчитать статистику
 */
async function calculateStats() {
    const calculateButton = document.getElementById('calculateButton');
    const loadingSection = document.getElementById('loadingSection');
    const resultsSection = document.getElementById('resultsSection');
    const errorMessage = document.getElementById('errorMessage');

    // Показать загрузку
    calculateButton.disabled = true;
    calculateButton.textContent = 'Загрузка...';
    loadingSection.style.display = 'block';
    resultsSection.style.display = 'none';
    errorMessage.style.display = 'none';

    try {
        const monday = currentWeekStart;
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);

        // Формируем даты в формате YYYY-MM-DD
        const startDate = formatDateISO(monday);
        const endDate = formatDateISO(sunday);

        // Загружаем данные параллельно
        const [energyData, habitsData] = await Promise.all([
            fetchEnergyData(startDate, endDate),
            fetchHabitsData(startDate, endDate)
        ]);

        // Отображаем результаты
        displayEnergyResults(energyData, monday, sunday);
        displayHabitsResults(habitsData);

        resultsSection.style.display = 'block';
    } catch (error) {
        console.error('Ошибка расчета статистики:', error);
        errorMessage.textContent = `Ошибка: ${error.message}`;
        errorMessage.style.display = 'block';
    } finally {
        calculateButton.disabled = false;
        calculateButton.textContent = 'Посчитать';
        loadingSection.style.display = 'none';
    }
}

/**
 * Форматировать дату в ISO формат (YYYY-MM-DD)
 */
function formatDateISO(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

/**
 * Загрузить данные об энергии за период
 */
async function fetchEnergyData(startDate, endDate) {
    if (!DATABASE_CONFIG.ENERGY_DATABASE_ID) {
        console.warn('ENERGY_DATABASE_ID не настроен');
        return [];
    }

    try {
        const dataSourceId = await getEnergyDataSourceId();
        const endpoint = `/data_sources/${dataSourceId}/query`;

        // Получаем схему для определения названий полей
        const schema = await getEnergyDatabaseSchema();

        const response = await notionRequest(endpoint, 'POST', {
            filter: {
                and: [
                    {
                        property: schema.dateField,
                        date: {
                            on_or_after: startDate
                        }
                    },
                    {
                        property: schema.dateField,
                        date: {
                            on_or_before: endDate
                        }
                    }
                ]
            },
            page_size: 100
        });

        // Парсим результаты
        const results = [];
        if (response.results) {
            for (const page of response.results) {
                const answerProp = page.properties?.[schema.answerField];
                if (answerProp?.select?.name) {
                    const answerText = answerProp.select.name.toLowerCase();
                    const score = ENERGY_MAPPING[answerText];
                    if (score !== undefined) {
                        results.push({
                            date: page.properties?.[schema.dateField]?.date?.start,
                            answer: answerProp.select.name,
                            score: score
                        });
                    }
                }
            }
        }

        return results;
    } catch (error) {
        console.error('Ошибка загрузки данных об энергии:', error);
        return [];
    }
}

/**
 * Загрузить данные о привычках за период
 */
async function fetchHabitsData(startDate, endDate) {
    try {
        const dataSourceId = await getDataSourceId();
        const endpoint = `/data_sources/${dataSourceId}/query`;

        const response = await notionRequest(endpoint, 'POST', {
            filter: {
                and: [
                    {
                        property: 'Date',
                        date: {
                            on_or_after: startDate
                        }
                    },
                    {
                        property: 'Date',
                        date: {
                            on_or_before: endDate
                        }
                    },
                    {
                        property: 'Completed',
                        checkbox: {
                            equals: true
                        }
                    }
                ]
            },
            page_size: 100
        });

        // Подсчитываем количество выполненных привычек
        const habitCounts = {};
        if (response.results) {
            for (const page of response.results) {
                const habitProp = page.properties?.Habit;
                if (habitProp?.title?.[0]?.plain_text) {
                    const habitName = habitProp.title[0].plain_text;
                    habitCounts[habitName] = (habitCounts[habitName] || 0) + 1;
                }
            }
        }

        return habitCounts;
    } catch (error) {
        console.error('Ошибка загрузки данных о привычках:', error);
        return {};
    }
}

/**
 * Отобразить результаты по энергии
 */
function displayEnergyResults(energyData, monday, sunday) {
    const calculationEl = document.getElementById('energyCalculation');
    const summaryEl = document.getElementById('energySummary');

    if (energyData.length === 0) {
        calculationEl.innerHTML = '<span class="no-data">Нет данных за этот период</span>';
        summaryEl.innerHTML = '';
        return;
    }

    // Сортируем по дате
    energyData.sort((a, b) => new Date(a.date) - new Date(b.date));

    // Формируем строку расчета
    const scores = energyData.map(d => d.score);
    const sum = scores.reduce((a, b) => a + b, 0);
    const avg = (sum / scores.length).toFixed(1);

    const calcString = `(${scores.join(' + ')}) / ${scores.length} = <strong>${avg}</strong>`;
    calculationEl.innerHTML = calcString;

    // Формируем итоговую строку
    const periodStr = `${formatDateShort(monday)} - ${formatDateShort(sunday)}`;
    summaryEl.innerHTML = `<strong>daily avg score</strong> за ${periodStr} = <span class="score-value">${avg}</span>`;
}

/**
 * Отобразить результаты по привычкам
 */
function displayHabitsResults(habitCounts) {
    const container = document.getElementById('habitsResults');

    let html = '';

    const categoryEmojis = {
        'Foundation & Health': '1️⃣',
        'Craft & Outs / Create': '2️⃣',
        'Learn & Grow / Explore': '3️⃣',
        'Connections / People': '4️⃣'
    };

    for (const [category, habits] of Object.entries(HABITS_GOALS)) {
        const emoji = categoryEmojis[category] || '📌';
        html += `<h2 class="category-title">${emoji} ${category}</h2>`;
        html += '<div class="habits-list">';

        for (const [habitName, goal] of Object.entries(habits)) {
            const count = habitCounts[habitName] || 0;
            const isComplete = count >= goal;
            const statusClass = isComplete ? 'habit-complete' : (count > 0 ? 'habit-partial' : 'habit-zero');

            html += `
                <div class="habit-stat-item ${statusClass}">
                    <span class="habit-stat-name">${habitName}:</span>
                    <span class="habit-stat-value">[${count} / ${goal}]</span>
                </div>
            `;
        }

        html += '</div>';
    }

    container.innerHTML = html;
}
