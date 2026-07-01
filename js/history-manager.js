/**
 * History Manager
 * Manages login history and account activity tracking
 */

class HistoryManager {
    constructor() {
        this.apiBase = 'api/history-api.php';
        this.loginHistory = [];
        this.activityHistory = [];
        this.currentTab = 'login';
    }

    /**
     * Initialize history manager
     */
    async init() {
        this.setupEventListeners();
        await this.loadLoginHistory();
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Tab switching
        document.querySelectorAll('[data-history-tab]').forEach(tab => {
            tab.addEventListener('click', (e) => {
                this.switchTab(e.target.dataset.historyTab);
            });
        });

        // Refresh buttons
        document.getElementById('refresh-login-history')?.addEventListener('click', () => {
            this.loadLoginHistory();
        });

        document.getElementById('refresh-activity-history')?.addEventListener('click', () => {
            this.loadActivityHistory();
        });

        // Filter buttons
        document.getElementById('filter-activity-btn')?.addEventListener('click', () => {
            this.showActivityFilterModal();
        });

        // Search
        document.getElementById('search-activity')?.addEventListener('input', (e) => {
            if (e.target.value.length > 2) {
                this.searchActivities(e.target.value);
            }
        });

        // Terminate session buttons
        document.addEventListener('click', (e) => {
            if (e.target.closest('[data-terminate-session]')) {
                const sessionId = e.target.closest('[data-terminate-session]').dataset.terminateSession;
                this.terminateSession(sessionId);
            }
        });
    }

    /**
     * Switch history tab
     */
    switchTab(tab) {
        this.currentTab = tab;

        // Update active tab
        document.querySelectorAll('[data-history-tab]').forEach(el => {
            el.classList.toggle('active', el.dataset.historyTab === tab);
        });

        // Show corresponding content
        document.querySelectorAll('[data-history-content]').forEach(el => {
            el.style.display = el.dataset.historyContent === tab ? 'block' : 'none';
        });

        // Load data if needed
        if (tab === 'activity') {
            this.loadActivityHistory();
        } else if (tab === 'devices') {
            this.loadActiveSessions();
        }
    }

    /**
     * Load login history
     */
    async loadLoginHistory() {
        try {
            const response = await fetch(`${this.apiBase}?action=get-login-history&limit=50`);
            const result = await response.json();

            if (result.success) {
                this.loginHistory = result.data;
                this.renderLoginHistory();
            } else {
                this.showError('Failed to load login history');
            }
        } catch (error) {
            console.error('Error loading login history:', error);
            this.showError('Error loading login history');
        }
    }

    /**
     * Load activity history
     */
    async loadActivityHistory() {
        try {
            const response = await fetch(`${this.apiBase}?action=get-activity-history&limit=50`);
            const result = await response.json();

            if (result.success) {
                this.activityHistory = result.data;
                this.renderActivityHistory();
            } else {
                this.showError('Failed to load activity history');
            }
        } catch (error) {
            console.error('Error loading activity history:', error);
            this.showError('Error loading activity history');
        }
    }

    /**
     * Load active sessions
     */
    async loadActiveSessions() {
        try {
            const response = await fetch(`${this.apiBase}?action=get-active-sessions`);
            const result = await response.json();

            if (result.success) {
                this.renderActiveSessions(result.data);
            } else {
                this.showError('Failed to load active sessions');
            }
        } catch (error) {
            console.error('Error loading active sessions:', error);
            this.showError('Error loading active sessions');
        }
    }

    /**
     * Render login history
     */
    renderLoginHistory() {
        const container = document.getElementById('login-history-table');
        if (!container) return;

        if (this.loginHistory.length === 0) {
            container.innerHTML = '<div class="empty">No login history</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Device</th>
                        <th>Location</th>
                        <th>IP Address</th>
                        <th>Login Time</th>
                        <th>Duration</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.loginHistory.map(login => `
                        <tr>
                            <td>
                                <strong>${login.device_name}</strong>
                                <div class="sku">${login.browser_info}</div>
                            </td>
                            <td>${login.location || 'Unknown'}</td>
                            <td><code>${login.ip_address}</code></td>
                            <td>${this.formatDateTime(login.login_time)}</td>
                            <td>${this.formatDuration(login.session_duration)}</td>
                            <td>
                                <span class="pill ${login.login_status === 'success' ? 'ok' : 'danger'}">
                                    ${login.login_status.toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }

    /**
     * Render activity history
     */
    renderActivityHistory() {
        const container = document.getElementById('activity-history-table');
        if (!container) return;

        if (this.activityHistory.length === 0) {
            container.innerHTML = '<div class="empty">No activity history</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Activity Type</th>
                        <th>Action</th>
                        <th>Module</th>
                        <th>Time</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    ${this.activityHistory.map(activity => `
                        <tr>
                            <td>
                                <strong>${activity.activity_type}</strong>
                            </td>
                            <td>
                                <span class="cell-ellipsis">${activity.action_description}</span>
                            </td>
                            <td>${activity.module_name || '-'}</td>
                            <td>${this.formatDateTime(activity.activity_time)}</td>
                            <td>
                                <span class="pill ${activity.status === 'success' ? 'ok' : 'danger'}">
                                    ${activity.status.toUpperCase()}
                                </span>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }

    /**
     * Render active sessions
     */
    renderActiveSessions(sessions) {
        const container = document.getElementById('active-sessions-table');
        if (!container) return;

        if (sessions.length === 0) {
            container.innerHTML = '<div class="empty">No active sessions</div>';
            return;
        }

        const html = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Device</th>
                        <th>Location</th>
                        <th>Login Time</th>
                        <th>Action</th>
                    </tr>
                </thead>
                <tbody>
                    ${sessions.map(session => `
                        <tr>
                            <td>
                                <strong>${session.device_name}</strong>
                                <div class="sku">${session.browser_info}</div>
                            </td>
                            <td>${session.location || 'Unknown'}</td>
                            <td>${this.formatDateTime(session.login_time)}</td>
                            <td>
                                <div class="row-actions">
                                    <button class="icon-btn" data-terminate-session="${session.id}" title="End session">
                                        <svg>
                                            <use xlink:href="#icon-close"></use>
                                        </svg>
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        container.innerHTML = html;
    }

    /**
     * Terminate session
     */
    async terminateSession(sessionId) {
        if (!confirm('Are you sure you want to end this session?')) {
            return;
        }

        try {
            const formData = new FormData();
            formData.append('action', 'terminate-session');
            formData.append('session_id', sessionId);

            const response = await fetch(this.apiBase, {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (result.success) {
                this.showSuccess('Session terminated');
                this.loadActiveSessions();
            } else {
                this.showError('Failed to terminate session');
            }
        } catch (error) {
            console.error('Error terminating session:', error);
            this.showError('Error terminating session');
        }
    }

    /**
     * Search activities
     */
    async searchActivities(keyword) {
        try {
            const response = await fetch(
                `${this.apiBase}?action=search-activities&keyword=${encodeURIComponent(keyword)}&limit=50`
            );
            const result = await response.json();

            if (result.success) {
                this.activityHistory = result.data;
                this.renderActivityHistory();
            }
        } catch (error) {
            console.error('Error searching activities:', error);
        }
    }

    /**
     * Show activity filter modal
     */
    showActivityFilterModal() {
        const modal = document.createElement('dialog');
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-head">
                <h3>Filter Activities</h3>
                <button class="icon-btn" onclick="this.closest('dialog').close()">
                    <svg><use xlink:href="#icon-close"></use></svg>
                </button>
            </div>
            <div class="form-grid">
                <div class="field">
                    <label>Activity Type</label>
                    <select id="filter-activity-type">
                        <option value="">All Types</option>
                        <option value="login">Login</option>
                        <option value="create">Create</option>
                        <option value="update">Update</option>
                        <option value="delete">Delete</option>
                        <option value="export">Export</option>
                    </select>
                </div>
                <div class="field">
                    <label>Status</label>
                    <select id="filter-activity-status">
                        <option value="">All Status</option>
                        <option value="success">Success</option>
                        <option value="failed">Failed</option>
                    </select>
                </div>
                <div class="field">
                    <label>From Date</label>
                    <input type="date" id="filter-date-from">
                </div>
                <div class="field">
                    <label>To Date</label>
                    <input type="date" id="filter-date-to">
                </div>
            </div>
            <div class="modal-foot">
                <button class="btn" onclick="this.closest('dialog').close()">Cancel</button>
                <button class="btn primary" onclick="historyManager.applyFilters(this.closest('dialog'))">Apply</button>
            </div>
        `;
        document.body.appendChild(modal);
        modal.showModal();
    }

    /**
     * Apply activity filters
     */
    async applyFilters(modal) {
        const filters = {
            activity_type: document.getElementById('filter-activity-type').value,
            status: document.getElementById('filter-activity-status').value,
            date_from: document.getElementById('filter-date-from').value,
            date_to: document.getElementById('filter-date-to').value
        };

        modal.close();
        modal.remove();

        try {
            const params = new URLSearchParams({
                action: 'get-activity-history',
                limit: 50,
                ...filters
            });

            const response = await fetch(`${this.apiBase}?${params}`);
            const result = await response.json();

            if (result.success) {
                this.activityHistory = result.data;
                this.renderActivityHistory();
            }
        } catch (error) {
            console.error('Error applying filters:', error);
        }
    }

    /**
     * Format date/time
     */
    formatDateTime(datetime) {
        const date = new Date(datetime);
        return date.toLocaleString('vi-VN');
    }

    /**
     * Format duration in seconds
     */
    formatDuration(seconds) {
        if (!seconds) return '-';
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;

        if (hours > 0) {
            return `${hours}h ${minutes}m`;
        }
        if (minutes > 0) {
            return `${minutes}m ${secs}s`;
        }
        return `${secs}s`;
    }

    /**
     * Show success message
     */
    showSuccess(message) {
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.textContent = message;
        toast.style.borderLeftColor = '#15803d';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }

    /**
     * Show error message
     */
    showError(message) {
        const toast = document.createElement('div');
        toast.className = 'toast show';
        toast.textContent = message;
        toast.style.borderLeftColor = '#c83232';
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
    }
}

// Initialize when DOM is ready
let historyManager;
document.addEventListener('DOMContentLoaded', () => {
    historyManager = new HistoryManager();
    historyManager.init();
});
