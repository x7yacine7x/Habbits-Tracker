class HabitTracker {
    constructor() {
        // Use in-memory storage for Claude.ai compatibility
        this.habits = this.loadHabits();
        this.currentPage = 'today';
        this.editingHabit = null;
        this.achievements = [
            { id: 'first_habit', name: 'Getting Started', description: 'Create your first habit', condition: () => this.habits.length >= 1 },
            { id: 'streak_7', name: 'Week Warrior', description: 'Maintain a 7-day streak', condition: () => this.getBestStreak() >= 7 },
            { id: 'streak_30', name: 'Month Master', description: 'Maintain a 30-day streak', condition: () => this.getBestStreak() >= 30 },
            { id: 'xp_1000', name: 'XP Collector', description: 'Earn 1000 total XP', condition: () => this.getTotalXP() >= 1000 },
            { id: 'perfect_week', name: 'Perfect Week', description: 'Complete all habits for 7 days', condition: () => this.checkPerfectWeek() },
            { id: 'habit_master', name: 'Habit Master', description: 'Maintain 10 active habits', condition: () => this.habits.length >= 10 }
        ];
        this.init();
    }

    loadHabits() {
        try {
            return JSON.parse(localStorage.getItem('habits')) || [];
        } catch (e) {
            // Fallback for Claude.ai environment
            return [];
        }
    }

    init() {
        this.bindEvents();
        this.render();
        this.updateStats();
        this.populateCategoryFilter();
        this.loadTheme();
        this.initSwipeGestures();
        this.initPullToRefresh();
    }

    bindEvents() {
        // Navigation
        document.querySelectorAll('.nav-btn').forEach(btn => {
            btn.addEventListener('click', (e) => this.switchPage(e.target.dataset.page));
        });

        // Add habit modal
        document.getElementById('add-habit-btn').addEventListener('click', () => this.showModal());
        document.querySelector('.close').addEventListener('click', () => this.hideModal());
        document.getElementById('habit-form').addEventListener('submit', (e) => this.addHabit(e));

        // Edit habit modal
        document.getElementById('edit-form').addEventListener('submit', (e) => this.saveEditHabit(e));

        // Schedule type change handling
        document.getElementById('habit-schedule').addEventListener('change', (e) => {
            this.handleScheduleChange(e.target.value);
        });

        // Category dropdown handling
        document.getElementById('habit-category').addEventListener('change', (e) => {
            const customInput = document.getElementById('custom-category');
            if (e.target.value === 'other') {
                customInput.style.display = 'block';
                customInput.required = true;
            } else {
                customInput.style.display = 'none';
                customInput.required = false;
                customInput.value = '';
            }
        });

        // Filters and sorting
        document.getElementById('category-filter').addEventListener('change', () => this.render());
        document.getElementById('sort-habits').addEventListener('change', () => this.render());

        // Modal close on outside click
        window.addEventListener('click', (e) => {
            const modal = document.getElementById('habit-modal');
            const editModal = document.getElementById('edit-modal');
            if (e.target === modal) {
                this.hideModal();
            }
            if (e.target === editModal) {
                this.hideEditModal();
            }
        });

        // Theme toggle
        document.getElementById('theme-toggle').addEventListener('click', () => this.toggleTheme());

        // Import/Export functionality
        document.getElementById('export-data-btn').addEventListener('click', () => this.exportData());
        document.getElementById('import-data-btn').addEventListener('click', () => document.getElementById('import-data-input').click());
        document.getElementById('import-data-input').addEventListener('change', (e) => this.importData(e));
    }

    handleScheduleChange(scheduleType) {
        const customDaysSection = document.getElementById('custom-days-section');

        if (scheduleType === 'custom') {
            customDaysSection.classList.add('active');
        } else {
            customDaysSection.classList.remove('active');
            // Clear all day selections when switching away from custom
            document.querySelectorAll('.day-checkbox').forEach(checkbox => {
                checkbox.checked = false;
            });
        }
    }

    switchPage(page) {
        // Update navigation
        document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-page="${page}"]`).classList.add('active');

        // Update pages
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(page).classList.add('active');

        this.currentPage = page;
        this.render();
    }

    showModal() {
        document.getElementById('habit-modal').style.display = 'block';
    }

    hideModal() {
        document.getElementById('habit-modal').style.display = 'none';
        document.getElementById('habit-form').reset();
        document.getElementById('custom-category').style.display = 'none';
        document.getElementById('custom-days-section').classList.remove('active');
        // Clear day selections
        document.querySelectorAll('.day-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
    }

    showEditModal(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        this.editingHabit = habit;
        document.getElementById('edit-habit-name').value = habit.name;
        document.getElementById('edit-habit-xp').value = habit.xp;
        document.getElementById('edit-habit-category').value = habit.category;
        document.getElementById('edit-habit-description').value = habit.description || '';
        document.getElementById('edit-modal').style.display = 'block';
    }

    hideEditModal() {
        document.getElementById('edit-modal').style.display = 'none';
        this.editingHabit = null;
    }

    addHabit(e) {
        e.preventDefault();

        const name = document.getElementById('habit-name').value.trim();
        const xp = parseInt(document.getElementById('habit-xp').value);
        const schedule = document.getElementById('habit-schedule').value;
        const categorySelect = document.getElementById('habit-category');
        const customCategory = document.getElementById('custom-category').value.trim();
        const description = document.getElementById('habit-description').value.trim();

        let category = categorySelect.value;
        if (category === 'other' && customCategory) {
            category = customCategory;
        }

        // Handle custom days selection
        let customDays = [];
        if (schedule === 'custom') {
            const selectedDays = document.querySelectorAll('.day-checkbox:checked');
            if (selectedDays.length === 0) {
                alert('Please select at least one day for your custom schedule.');
                return;
            }
            customDays = Array.from(selectedDays).map(checkbox => parseInt(checkbox.value));
        }

        const habit = {
            id: Date.now(),
            name,
            xp,
            schedule,
            customDays: schedule === 'custom' ? customDays : [],
            category: category || 'General',
            description: description || '',
            streak: 0,
            completions: {},
            createdAt: new Date().toISOString()
        };

        this.habits.push(habit);
        this.saveHabits();
        this.hideModal();
        this.render();
        this.updateStats();
        this.populateCategoryFilter();
    }

    saveEditHabit(e) {
        e.preventDefault();

        if (!this.editingHabit) return;

        this.editingHabit.name = document.getElementById('edit-habit-name').value.trim();
        this.editingHabit.xp = parseInt(document.getElementById('edit-habit-xp').value);
        this.editingHabit.category = document.getElementById('edit-habit-category').value.trim();
        this.editingHabit.description = document.getElementById('edit-habit-description').value.trim();

        this.saveHabits();
        this.hideEditModal();
        this.render();
        this.updateStats();
        this.populateCategoryFilter();
    }

    isHabitActiveToday(habit) {
        const today = new Date();
        const todayDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.

        switch (habit.schedule) {
            case 'daily':
                return true;
            case 'weekly':
                return true; // Weekly habits can be completed any day
            case 'custom':
                return habit.customDays && habit.customDays.includes(todayDay);
            default:
                return true;
        }
    }

    isHabitActiveOnDate(habit, date) {
        const dayOfWeek = date.getDay();

        switch (habit.schedule) {
            case 'daily':
                return true;
            case 'weekly':
                return true; // Weekly habits can be completed any day
            case 'custom':
                return habit.customDays && habit.customDays.includes(dayOfWeek);
            default:
                return true;
        }
    }

    completeHabit(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const today = this.getDateString(new Date());

        if (habit.completions[today]) return;
        if (!this.isHabitActiveToday(habit)) return;

        habit.completions[today] = true;

        // Update streak
        this.updateStreak(habit);

        this.saveHabits();
        this.render();
        this.updateStats();
        this.showCompletionAnimation();
        this.playCompletionSound();
        this.triggerHaptic('success');
    }

    uncompleteHabit(habitId) {
        const habit = this.habits.find(h => h.id === habitId);
        if (!habit) return;

        const today = this.getDateString(new Date());

        if (!habit.completions[today]) return;

        delete habit.completions[today];
        this.updateStreak(habit);

        this.saveHabits();
        this.render();
        this.updateStats();
    }

    updateStreak(habit) {
        const today = new Date();
        let streak = 0;
        let currentDate = new Date(today);

        // Count backwards from today to find consecutive completions
        while (true) {
            const dateString = this.getDateString(currentDate);

            // Check if habit is active on this day and completed
            if (this.isHabitActiveOnDate(habit, currentDate) && habit.completions[dateString]) {
                streak++;
            } else if (this.isHabitActiveOnDate(habit, currentDate)) {
                // If habit is active but not completed, break the streak
                break;
            }
            // If habit is not active on this day, skip it and continue checking

            currentDate.setDate(currentDate.getDate() - 1);

            // Prevent infinite loop - only check last 365 days
            if (this.daysBetween(currentDate, today) > 365) break;
        }

        habit.streak = streak;
    }

    daysBetween(date1, date2) {
        const oneDay = 24 * 60 * 60 * 1000;
        return Math.round(Math.abs((date1 - date2) / oneDay));
    }

    deleteHabit(habitId) {
        if (confirm('Are you sure you want to delete this habit? This action cannot be undone.')) {
            this.habits = this.habits.filter(h => h.id !== habitId);
            this.saveHabits();
            this.render();
            this.updateStats();
            this.populateCategoryFilter();
        }
    }

    showCompletionAnimation() {
        // Simple celebration effect
        if (event && event.target) {
            const button = event.target;
            button.style.transform = 'scale(1.2)';
            setTimeout(() => {
                button.style.transform = 'scale(1)';
            }, 200);
        }
    }

    playCompletionSound() {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();

            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);

            oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
            oscillator.frequency.setValueAtTime(1000, audioContext.currentTime + 0.1);

            gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3);

            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.3);
        } catch (error) {
            console.log('Audio not available:', error);
        }
    }

    populateCategoryFilter() {
        const categories = [...new Set(this.habits.map(h => h.category))];
        const filter = document.getElementById('category-filter');
        const currentValue = filter.value;

        filter.innerHTML = '<option value="all">All Categories</option>';
        categories.forEach(cat => {
            const option = document.createElement('option');
            option.value = cat;
            option.textContent = cat;
            filter.appendChild(option);
        });

        if (categories.includes(currentValue)) {
            filter.value = currentValue;
        }
    }

    getFilteredAndSortedHabits(habits) {
        const categoryFilter = document.getElementById('category-filter')?.value || 'all';
        const sortBy = document.getElementById('sort-habits')?.value || 'name';

        let filtered = habits;
        if (categoryFilter !== 'all') {
            filtered = habits.filter(h => h.category === categoryFilter);
        }

        return filtered.sort((a, b) => {
            switch (sortBy) {
                case 'xp':
                    return b.xp - a.xp;
                case 'streak':
                    return b.streak - a.streak;
                case 'name':
                default:
                    return a.name.localeCompare(b.name);
            }
        });
    }

    isCompletedToday(habit) {
        const today = this.getDateString(new Date());
        return habit.completions[today] || false;
    }

    isCompletedThisWeek(habit) {
        if (habit.schedule === 'weekly') {
            const weekStart = this.getWeekStart(new Date());
            const weekDays = [];

            for (let i = 0; i < 7; i++) {
                const day = new Date(weekStart);
                day.setDate(weekStart.getDate() + i);
                weekDays.push(this.getDateString(day));
            }

            return weekDays.some(day => habit.completions[day]);
        }

        return this.isCompletedToday(habit);
    }

    getWeekStart(date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day;
        return new Date(d.setDate(diff));
    }

    getDateString(date) {
        return date.toISOString().split('T')[0];
    }

    getDayName(dayNumber) {
        const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        return days[dayNumber];
    }

    getCustomDaysText(customDays) {
        if (!customDays || customDays.length === 0) return '';
        if (customDays.length === 7) return 'Every day';

        const dayNames = customDays.map(day => this.getDayName(day).substring(0, 3));
        return dayNames.join(', ');
    }

    render() {
        switch (this.currentPage) {
            case 'today':
                this.renderTodayHabits();
                break;
            case 'week':
                this.renderWeekHabits();
                break;
            case 'stats':
                this.renderStats();
                break;
        }
    }

    renderTodayHabits() {
        const container = document.getElementById('today-habits');

        if (this.habits.length === 0) {
            container.innerHTML = `
                <div style="text-align: center; padding: 3rem; color: #7f8c8d;">
                    <h3>No habits added yet</h3>
                    <p>Click "Add New Habit" to start building better habits!</p>
                </div>
            `;
            document.getElementById('daily-progress').textContent = '0/0 completed';
            document.getElementById('daily-xp').textContent = '0 XP earned';
            return;
        }

        const todayHabits = this.habits.filter(habit => this.isHabitActiveToday(habit));
        const completedToday = todayHabits.filter(habit => this.isCompletedToday(habit));
        const todayXP = completedToday.reduce((total, habit) => {
            let xp = habit.xp;
            // Add streak bonus for habits with 7+ day streaks
            if (habit.streak >= 7) {
                xp += Math.floor(habit.xp * 0.2);
            }
            return total + xp;
        }, 0);

        document.getElementById('daily-progress').textContent = `${completedToday.length}/${todayHabits.length} completed`;
        document.getElementById('daily-xp').textContent = `${todayXP} XP earned`;

        const filteredHabits = this.getFilteredAndSortedHabits(todayHabits);

        container.innerHTML = filteredHabits.map(habit => {
            const completed = this.isCompletedToday(habit);
            const bonusXP = habit.streak >= 7 ? Math.floor(habit.xp * 0.2) : 0;

            let scheduleText = '';
            if (habit.schedule === 'custom' && habit.customDays) {
                scheduleText = this.getCustomDaysText(habit.customDays);
            } else if (habit.schedule === 'weekly') {
                scheduleText = 'Weekly';
            } else {
                scheduleText = 'Daily';
            }

            return `
                <div class="habit-item ${completed ? 'habit-completed' : ''}">
                    <div class="habit-header">
                        <div>
                            <div class="habit-name">${habit.name}</div>
                            ${habit.description ? `<div class="habit-description">${habit.description}</div>` : ''}
                            <div class="habit-schedule-info">Schedule: ${scheduleText}</div>
                        </div>
                        <div class="habit-badges">
                            <span class="habit-xp">${habit.xp + bonusXP} XP</span>
                            <span class="habit-category ${habit.category}">${habit.category}</span>
                        </div>
                    </div>
                    <div class="habit-info">
                        <span class="habit-streak">🔥 ${habit.streak} day streak</span>
                        ${bonusXP > 0 ? `<span class="bonus-xp">+${bonusXP} streak bonus</span>` : ''}
                    </div>
                    <div class="habit-actions">
                        ${completed
                            ? `<button class="btn secondary small" onclick="app.uncompleteHabit(${habit.id})">Undo</button>`
                            : `<button class="btn success small" onclick="app.completeHabit(${habit.id})">Complete</button>`
                        }
                        <button class="btn secondary small" onclick="app.showEditModal(${habit.id})">Edit</button>
                        <button class="btn danger small" onclick="app.deleteHabit(${habit.id})">Delete</button>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderWeekHabits() {
        const container = document.getElementById('week-habits');

        if (this.habits.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 3rem; color: #7f8c8d;"><p>No habits added yet.</p></div>';
            document.getElementById('week-completion').textContent = '0% completion rate';
            document.getElementById('week-xp').textContent = '0 XP this week';
            return;
        }

        const weekStart = this.getWeekStart(new Date());
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const today = this.getDateString(new Date());

        // Calculate week stats
        const weekDates = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            weekDates.push({ date: this.getDateString(day), dayObj: new Date(day) });
        }

        let totalPossibleCompletions = 0;
        let totalCompletions = 0;
        let weekXP = 0;

        this.habits.forEach(habit => {
            weekDates.forEach(({ date, dayObj }) => {
                if (this.isHabitActiveOnDate(habit, dayObj)) {
                    totalPossibleCompletions++;
                    if (habit.completions[date]) {
                        totalCompletions++;
                        weekXP += habit.xp;
                    }
                }
            });
        });

        const completionRate = totalPossibleCompletions > 0 ? Math.round((totalCompletions / totalPossibleCompletions) * 100) : 0;

        document.getElementById('week-completion').textContent = `${completionRate}% completion rate`;
        document.getElementById('week-xp').textContent = `${weekXP} XP this week`;

        container.innerHTML = this.habits.map(habit => {
            const weekDays = weekDates.map(({ date, dayObj }, i) => {
                const isCompleted = habit.completions[date] || false;
                const isToday = date === today;
                const isActive = this.isHabitActiveOnDate(habit, dayObj);

                return `
                    <div class="day ${isCompleted ? 'completed' : ''} ${isToday ? 'today' : ''} ${!isActive ? 'inactive' : ''}" 
                         ${isActive ? `onclick="app.toggleHabitDay('${habit.id}', '${date}')"` : ''}>
                        <div>${days[i]}</div>
                        <div>${dayObj.getDate()}</div>
                    </div>
                `;
            });

            let scheduleText = '';
            if (habit.schedule === 'custom' && habit.customDays) {
                scheduleText = this.getCustomDaysText(habit.customDays);
            } else if (habit.schedule === 'weekly') {
                scheduleText = 'Weekly';
            } else {
                scheduleText = 'Daily';
            }

            return `
                <div class="week-habit">
                    <div class="habit-header">
                        <div>
                            <div class="habit-name">${habit.name}</div>
                            ${habit.description ? `<div class="habit-description">${habit.description}</div>` : ''}
                            <div class="habit-schedule-info">Schedule: ${scheduleText}</div>
                        </div>
                        <div class="habit-badges">
                            <span class="habit-xp">${habit.xp} XP</span>
                            <span class="habit-category ${habit.category}">${habit.category}</span>
                        </div>
                    </div>
                    <div class="week-days">
                        ${weekDays.join('')}
                    </div>
                </div>
            `;
        }).join('');
    }

    toggleHabitDay(habitId, dateString) {
        const habit = this.habits.find(h => h.id === parseInt(habitId));
        if (!habit) return;

        const date = new Date(dateString);
        if (!this.isHabitActiveOnDate(habit, date)) return;

        if (habit.completions[dateString]) {
            delete habit.completions[dateString];
        } else {
            habit.completions[dateString] = true;
        }

        this.updateStreak(habit);
        this.saveHabits();
        this.render();
        this.updateStats();
    }

    renderStats() {
        this.updateStats();
        this.renderAchievements();
        this.renderWeeklyChart();
    }

    renderAchievements() {
        const container = document.getElementById('achievements-list');

        container.innerHTML = this.achievements.map(achievement => {
            const unlocked = achievement.condition();
            return `
                <div class="achievement ${unlocked ? 'unlocked' : ''}">
                    <div style="font-size: 1.5rem; margin-bottom: 0.5rem;">
                        ${unlocked ? '🏆' : '🔒'}
                    </div>
                    <div style="font-weight: bold; margin-bottom: 0.25rem;">
                        ${achievement.name}
                    </div>
                    <div style="font-size: 0.8rem;">
                        ${achievement.description}
                    </div>
                </div>
            `;
        }).join('');
    }

    renderWeeklyChart() {
        const container = document.getElementById('weekly-chart');
        const weekStart = this.getWeekStart(new Date());
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

        const weekData = [];
        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            const dateString = this.getDateString(day);

            let possibleCompletions = 0;
            let actualCompletions = 0;

            this.habits.forEach(habit => {
                if (this.isHabitActiveOnDate(habit, day)) {
                    possibleCompletions++;
                    if (habit.completions[dateString]) {
                        actualCompletions++;
                    }
                }
            });

            weekData.push({
                day: days[i],
                completions: actualCompletions,
                total: possibleCompletions
            });
        }

        if (this.habits.length === 0) {
            container.innerHTML = '<p style="text-align: center; color: #7f8c8d;">Add some habits to see your progress chart</p>';
            return;
        }

        const maxHeight = 150;
        const maxCompletions = Math.max(1, Math.max(...weekData.map(d => d.total)));

        container.innerHTML = `
            <div style="display: flex; align-items: end; justify-content: space-around; height: ${maxHeight + 40}px; padding: 0 1rem;">
                ${weekData.map(data => {
                    const height = data.total > 0 ? (data.completions / data.total) * maxHeight : 0;
                    const percentage = data.total > 0 ? Math.round((data.completions / data.total) * 100) : 0;

                    return `
                        <div style="text-align: center; flex: 1;">
                            <div style="
                                height: ${Math.max(height, 4)}px;
                                background: linear-gradient(135deg, #3498db, #2980b9);
                                margin: 0 2px;
                                border-radius: 4px 4px 0 0;
                                display: flex;
                                align-items: end;
                                justify-content: center;
                                color: white;
                                font-size: 0.8rem;
                                font-weight: bold;
                            ">
                                ${height > 20 ? `${data.completions}` : ''}
                            </div>
                            <div style="margin-top: 0.5rem; font-size: 0.8rem; color: #7f8c8d;">
                                ${data.day}
                            </div>
                            <div style="font-size: 0.7rem; color: #bdc3c7;">
                                ${percentage}%
                            </div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    }

    updateStats() {
        const totalXP = this.getTotalXP();
        const completedToday = this.getCompletedToday();
        const bestStreak = this.getBestStreak();
        const totalHabits = this.habits.length;
        const currentLevel = Math.floor(totalXP / 100) + 1;

        document.getElementById('total-xp').textContent = totalXP.toLocaleString();
        document.getElementById('completed-today').textContent = completedToday;
        document.getElementById('best-streak').textContent = bestStreak;
        document.getElementById('total-habits').textContent = totalHabits;
        document.getElementById('current-level').textContent = currentLevel;
    }

    getTotalXP() {
        return this.habits.reduce((total, habit) => {
            let xp = 0;
            Object.keys(habit.completions).forEach(date => {
                if (habit.completions[date]) {
                    xp += habit.xp;
                    // Add streak bonus for habits with 7+ day streaks
                    if (habit.streak >= 7) {
                        xp += Math.floor(habit.xp * 0.2);
                    }
                }
            });
            return total + xp;
        }, 0);
    }

    getCompletedToday() {
        const today = this.getDateString(new Date());
        return this.habits.filter(habit =>
            this.isHabitActiveToday(habit) && habit.completions[today]
        ).length;
    }

    getBestStreak() {
        return Math.max(0, ...this.habits.map(h => h.streak));
    }

    checkPerfectWeek() {
        const weekStart = this.getWeekStart(new Date());
        const weekDates = [];

        for (let i = 0; i < 7; i++) {
            const day = new Date(weekStart);
            day.setDate(weekStart.getDate() + i);
            weekDates.push({ date: this.getDateString(day), dayObj: new Date(day) });
        }

        if (this.habits.length === 0) return false;

        return weekDates.every(({ date, dayObj }) => {
            return this.habits.every(habit => {
                // If habit is not active on this day, it doesn't count against perfect week
                if (!this.isHabitActiveOnDate(habit, dayObj)) return true;
                // If habit is active on this day, it must be completed
                return habit.completions[date];
            });
        });
    }

    saveHabits() {
        try {
            localStorage.setItem('habits', JSON.stringify(this.habits));
        } catch (e) {
            // Graceful fallback for environments without localStorage
            console.log('Data persistence not available in this environment');
        }
    }

    toggleTheme() {
        const body = document.body;
        const themeToggle = document.getElementById('theme-toggle');

        if (body.classList.contains('dark-theme')) {
            body.classList.remove('dark-theme');
            themeToggle.textContent = '🌙';
            this.saveTheme('light');
        } else {
            body.classList.add('dark-theme');
            themeToggle.textContent = '☀️';
            this.saveTheme('dark');
        }
    }

    initSwipeGestures() {
        let startX = 0;
        let startY = 0;

        document.addEventListener('touchstart', (e) => {
            startX = e.touches[0].clientX;
            startY = e.touches[0].clientY;
        });

        document.addEventListener('touchend', (e) => {
            if (!startX || !startY) return;

            const endX = e.changedTouches[0].clientX;
            const endY = e.changedTouches[0].clientY;

            const diffX = startX - endX;
            const diffY = startY - endY;

            // Only register horizontal swipes
            if (Math.abs(diffX) > Math.abs(diffY) && Math.abs(diffX) > 50) {
                if (diffX > 0) {
                    // Swipe left - next page
                    this.swipeToNextPage();
                } else {
                    // Swipe right - previous page
                    this.swipeToPrevPage();
                }
            }

            startX = 0;
            startY = 0;
        });
    }

    swipeToNextPage() {
        const pages = ['today', 'week', 'stats'];
        const currentIndex = pages.indexOf(this.currentPage);
        const nextIndex = (currentIndex + 1) % pages.length;
        this.switchPage(pages[nextIndex]);
    }

    swipeToPrevPage() {
        const pages = ['today', 'week', 'stats'];
        const currentIndex = pages.indexOf(this.currentPage);
        const prevIndex = currentIndex === 0 ? pages.length - 1 : currentIndex - 1;
        this.switchPage(pages[prevIndex]);
    }

    loadTheme() {
        try {
            const savedTheme = localStorage.getItem('theme') || 'light';
            if (savedTheme === 'dark') {
                document.body.classList.add('dark-theme');
                document.getElementById('theme-toggle').textContent = '☀️';
            }
        } catch (e) {
            // Fallback for Claude.ai environment
            console.log('Theme persistence not available');
        }
    }

    saveTheme(theme) {
        try {
            localStorage.setItem('theme', theme);
        } catch (e) {
            // Fallback for Claude.ai environment
            console.log('Theme persistence not available');
        }
    }

    initPullToRefresh() {
        let startY = 0;
        let pullDistance = 0;
        const threshold = 80;

        const refreshElement = document.createElement('div');
        refreshElement.className = 'pull-refresh';
        refreshElement.innerHTML = 'Pull down to refresh...';
        refreshElement.style.cssText = `
            position: fixed;
            top: -50px;
            left: 0;
            right: 0;
            height: 50px;
            background: var(--primary-color);
            color: white;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: transform 0.3s ease;
            z-index: 999;
        `;
        document.body.prepend(refreshElement);

        document.addEventListener('touchstart', (e) => {
            if (window.scrollY === 0) {
                startY = e.touches[0].clientY;
            }
        });

        document.addEventListener('touchmove', (e) => {
            if (startY && window.scrollY === 0) {
                pullDistance = e.touches[0].clientY - startY;
                if (pullDistance > 0) {
                    e.preventDefault();
                    const transform = Math.min(pullDistance, threshold);
                    refreshElement.style.transform = `translateY(${transform}px)`;
                    
                    if (pullDistance >= threshold) {
                        refreshElement.innerHTML = 'Release to refresh...';
                    } else {
                        refreshElement.innerHTML = 'Pull down to refresh...';
                    }
                }
            }
        });

        document.addEventListener('touchend', () => {
            if (pullDistance >= threshold) {
                refreshElement.innerHTML = 'Refreshing...';
                setTimeout(() => {
                    this.render();
                    this.updateStats();
                    refreshElement.style.transform = 'translateY(-50px)';
                    refreshElement.innerHTML = 'Pull down to refresh...';
                }, 1000);
            } else {
                refreshElement.style.transform = 'translateY(-50px)';
            }
            startY = 0;
            pullDistance = 0;
        });
    }

    triggerHaptic(type = 'light') {
        try {
            if (navigator.vibrate) {
                switch (type) {
                    case 'success':
                        navigator.vibrate([50, 50, 100]);
                        break;
                    case 'light':
                        navigator.vibrate(50);
                        break;
                    case 'medium':
                        navigator.vibrate(100);
                        break;
                    default:
                        navigator.vibrate(50);
                }
            }
        } catch (error) {
            console.log('Haptic feedback not available:', error);
        }
    }

    // Import/Export functionality
    exportData() {
        const data = {
            habits: this.habits,
            exportDate: new Date().toISOString(),
            version: "1.0"
        };
        const jsonData = JSON.stringify(data, null, 2);
        const blob = new Blob([jsonData], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `habit_tracker_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        alert("Data exported successfully!");
    }

    importData(event) {
        const file = event.target.files[0];
        if (!file) {
            return;
        }
        
        if (!file.name.endsWith('.json')) {
            alert("Please select a valid JSON file.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const importedData = JSON.parse(e.target.result);
                
                // Handle both old format (direct array) and new format (object with habits array)
                let habitsToImport;
                if (Array.isArray(importedData)) {
                    habitsToImport = importedData;
                } else if (importedData.habits && Array.isArray(importedData.habits)) {
                    habitsToImport = importedData.habits;
                } else {
                    throw new Error("Invalid data format");
                }

                // Validate habit structure
                const isValidHabit = (habit) => {
                    return habit && 
                           typeof habit.id !== 'undefined' && 
                           typeof habit.name === 'string' && 
                           typeof habit.xp === 'number' &&
                           typeof habit.completions === 'object';
                };

                if (!habitsToImport.every(isValidHabit)) {
                    throw new Error("Invalid habit data structure");
                }

                // Confirm import if user has existing data
                if (this.habits.length > 0) {
                    const confirmImport = confirm(
                        `This will replace your current ${this.habits.length} habit(s) with ${habitsToImport.length} imported habit(s). Continue?`
                    );
                    if (!confirmImport) {
                        return;
                    }
                }

                this.habits = habitsToImport;
                this.saveHabits();
                this.render();
                this.updateStats();
                this.populateCategoryFilter();
                alert(`Successfully imported ${habitsToImport.length} habit(s)!`);
                
                // Reset file input
                event.target.value = '';
                
            } catch (error) {
                alert("Error importing data: " + error.message);
                console.error("Error importing data:", error);
                event.target.value = '';
            }
        };
        reader.readAsText(file);
    }
}

// Initialize the app
const app = new HabitTracker();

