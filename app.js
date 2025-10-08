// Main application JavaScript
import { saveDailyData, fetchAllData, getConnectionStatus } from './firebase-config.js';

// Application state
let heatmapData = [];
let currentTooltip = null;

// DOM elements
const generateButton = document.getElementById('generateButton');
const heatmapGrid = document.getElementById('heatmapGrid');
const tooltip = document.getElementById('tooltip');

// Scoring system configuration
const SCORING = {
    status: {
        'passed': 10,
        'failed': 0,
        'other-important-work': 10,
        'intentionally-declined': 10
    },
    productivity: {
        'highly-productive': 10,
        'productive': 8,
        'average': 6,
        'below-average': 4,
        'least-productive': 2
    }
};

// Color mapping for scores - Only green variations
const COLOR_MAPPING = {
    80: '#0c6111ff',  // Dark Green (81-100)
    60: '#349e39ff',  // Medium Green (61-80)
    40: '#3cd841ff',  // Light Green (41-60)
    20: '#65cd68ff',  // Very Light Green (21-40)
    0: '#E8F5E8'    // Lightest Green (1-20)
};

/**
 * Initialize the application
 */
async function initializeApp() {
    console.log('Initializing AI Productivity Tracker...');
    
    // Show connection status
    console.log('Connection status:', getConnectionStatus());
    
    // Set up event listeners
    setupEventListeners();
    
    // Generate heatmap grid
    generateHeatmapGrid();
    
    // Load existing data
    await loadHeatmapData();
    
    // Load and lock today's phases
    await loadTodayPhases();
    
    // Register service worker
    registerServiceWorker();
    
    console.log('App initialized successfully');
}

/**
 * Set up all event listeners
 */
function setupEventListeners() {
    // Generate button click handler
    generateButton.addEventListener('click', handleGenerateClick);
    
    // Status dropdown change handlers
    const statusDropdowns = document.querySelectorAll('.status-dropdown');
    statusDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', (e) => {
            handleStatusChange(e);
            validateInputs();
        });
    });
    
    // Productivity dropdown change handlers
    const productivityDropdowns = document.querySelectorAll('.productivity-dropdown');
    productivityDropdowns.forEach(dropdown => {
        dropdown.addEventListener('change', validateInputs);
    });
    
    // Initial validation
    validateInputs();
}

/**
 * Handle generate button click
 */
async function handleGenerateClick() {
    try {
        // Disable button and show loading
        generateButton.disabled = true;
        generateButton.innerHTML = '<span class="loading"></span> Generating...';
        
        // Collect data from dropdowns
        const phaseData = collectPhaseData();
        
        // Validate that at least one phase has status selected
        if (!validateAllPhases(phaseData)) {
            showMessage('Please select status for at least one phase.', 'error');
            return;
        }
        
        // Get current date and weekday
        const now = new Date();
        const date = formatDate(now);
        const weekday = getWeekday(now);
        
        // Save individual phases and lock them
        const success = await savePhaseData(date, weekday, phaseData);
        
        // Calculate and display current score
        const score = calculateProductivityScore(phaseData);
        const color = getColorForScore(score);
        
        if (success) {
            showMessage(`Phase saved! Current Score: ${score}/100`, 'success');
            
            // Lock the saved phases
            lockSavedPhases(date);
            
            // Update heatmap with current color
            await updateHeatmapColor(date, weekday, score, color);
            
            // Reload heatmap data
            await loadHeatmapData();
        } else {
            throw new Error('Failed to save data');
        }
        
    } catch (error) {
        console.error('Error generating daily color:', error);
        showMessage('Error generating daily color. Please try again.', 'error');
    } finally {
        // Re-enable button
        generateButton.disabled = false;
        generateButton.textContent = 'Generate Daily Color';
    }
}

/**
 * Collect data from all phase dropdowns
 * @returns {Array} Array of phase data objects
 */
function collectPhaseData() {
    const phases = [];
    
    for (let i = 1; i <= 5; i++) {
        const statusSelect = document.querySelector(`.status-dropdown[data-phase="${i}"]`);
        const productivitySelect = document.querySelector(`.productivity-dropdown[data-phase="${i}"]`);
        
        phases.push({
            phase: i,
            status: statusSelect.value,
            productivity: productivitySelect.value
        });
    }
    
    return phases;
}

/**
 * Validate that at least one phase has status selected
 * @param {Array} phaseData - Array of phase data objects
 * @returns {boolean} True if at least one phase has status selected
 */
function validateAllPhases(phaseData) {
    return phaseData.some(phase => phase.status);
}

/**
 * Calculate productivity score based on phase data
 * @param {Array} phaseData - Array of phase data objects
 * @returns {number} Total productivity score
 */
function calculateProductivityScore(phaseData) {
    let totalScore = 0;
    
    phaseData.forEach(phase => {
        if (phase.status) {
            const statusScore = SCORING.status[phase.status] || 0;
            
            // If failed, no productivity score regardless of selection
            if (phase.status === 'failed') {
                totalScore += 0; // Failed = 0 points total
            } else {
                // For passed, other-important-work, intentionally-declined
                let productivityScore = 0;
                if (phase.productivity) {
                    productivityScore = SCORING.productivity[phase.productivity] || 0;
                }
                totalScore += statusScore + productivityScore;
            }
        }
    });
    
    // Each task contributes max 20 points (10 status + 10 productivity)
    // Total possible = 5 * 20 = 100 points
    return Math.min(100, Math.max(0, totalScore));
}

/**
 * Get color based on productivity score - Only green variations
 * @param {number} score - Productivity score (0-100)
 * @returns {string} Hex color code
 */
function getColorForScore(score) {
    if (score === 0) return '#f0f0f0'; // No color for 0 score
    if (score >= 81) return COLOR_MAPPING[80]; // Dark Green (81-100)
    if (score >= 61) return COLOR_MAPPING[60]; // Medium Green (61-80)
    if (score >= 41) return COLOR_MAPPING[40]; // Light Green (41-60)
    if (score >= 21) return COLOR_MAPPING[20]; // Very Light Green (21-40)
    return COLOR_MAPPING[0]; // Lightest Green (1-20)
}

/**
 * Generate the 30-day heatmap grid
 */
function generateHeatmapGrid() {
    heatmapGrid.innerHTML = ''; // Clear existing grid
    
    // Generate 30 days (5 rows × 6 columns)
    for (let i = 29; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        
        const dayElement = document.createElement('div');
        dayElement.className = 'heatmap-day';
        dayElement.dataset.date = formatDate(date);
        dayElement.dataset.day = date.getDate();
        dayElement.textContent = date.getDate();
        
        // Add hover events for tooltip
        dayElement.addEventListener('mouseenter', showTooltip);
        dayElement.addEventListener('mouseleave', hideTooltip);
        dayElement.addEventListener('mousemove', moveTooltip);
        
        heatmapGrid.appendChild(dayElement);
    }
}

/**
 * Load heatmap data from Firebase/localStorage and update display
 */
async function loadHeatmapData() {
    try {
        heatmapData = await fetchAllData();
        updateHeatmapDisplay();
    } catch (error) {
        console.error('Error loading heatmap data:', error);
        showMessage('Error loading data. Please refresh the page.', 'error');
    }
}

/**
 * Update the heatmap display with loaded data
 */
function updateHeatmapDisplay() {
    const dayElements = document.querySelectorAll('.heatmap-day');
    
    dayElements.forEach(dayElement => {
        const date = dayElement.dataset.date;
        const data = heatmapData.find(item => item.date === date);
        
        if (data) {
            dayElement.style.backgroundColor = data.color;
            dayElement.classList.add('has-data');
            dayElement.dataset.score = data.score;
            dayElement.dataset.weekday = data.weekday;
            
            // Add animation for new data
            dayElement.classList.add('new-data');
            setTimeout(() => dayElement.classList.remove('new-data'), 300);
        } else {
            dayElement.style.backgroundColor = '#f0f0f0';
            dayElement.classList.remove('has-data');
            delete dayElement.dataset.score;
            delete dayElement.dataset.weekday;
        }
    });
}

/**
 * Show tooltip on hover
 * @param {Event} event - Mouse event
 */
function showTooltip(event) {
    const dayElement = event.target;
    const date = dayElement.dataset.date;
    const score = dayElement.dataset.score;
    const weekday = dayElement.dataset.weekday;
    
    let tooltipContent;
    if (score !== undefined) {
        const formattedDate = formatDateForDisplay(new Date(date));
        tooltipContent = `${formattedDate}<br>${weekday}<br>Score: ${score}/100`;
    } else {
        const formattedDate = formatDateForDisplay(new Date(date));
        tooltipContent = `${formattedDate}<br>No data`;
    }
    
    tooltip.innerHTML = tooltipContent;
    tooltip.classList.add('show');
    
    moveTooltip(event);
}

/**
 * Hide tooltip
 */
function hideTooltip() {
    tooltip.classList.remove('show');
}

/**
 * Move tooltip with mouse
 * @param {Event} event - Mouse event
 */
function moveTooltip(event) {
    const rect = event.target.getBoundingClientRect();
    const tooltipRect = tooltip.getBoundingClientRect();
    
    let left = event.clientX + 10;
    let top = event.clientY - tooltipRect.height - 10;
    
    // Adjust if tooltip goes off screen
    if (left + tooltipRect.width > window.innerWidth) {
        left = event.clientX - tooltipRect.width - 10;
    }
    
    if (top < 0) {
        top = event.clientY + 10;
    }
    
    tooltip.style.left = left + 'px';
    tooltip.style.top = top + 'px';
}

/**
 * Handle status dropdown change - disable productivity if failed is selected
 * @param {Event} event - Change event from status dropdown
 */
function handleStatusChange(event) {
    const statusSelect = event.target;
    const phase = statusSelect.dataset.phase;
    const productivitySelect = document.querySelector(`.productivity-dropdown[data-phase="${phase}"]`);
    
    if (statusSelect.value === 'failed') {
        // Disable and reset productivity dropdown for failed status
        productivitySelect.disabled = true;
        productivitySelect.value = '';
        productivitySelect.style.opacity = '0.5';
        productivitySelect.style.cursor = 'not-allowed';
    } else {
        // Enable productivity dropdown for other statuses
        productivitySelect.disabled = false;
        productivitySelect.style.opacity = '1';
        productivitySelect.style.cursor = 'pointer';
    }
}

/**
 * Validate form inputs and update button state
 */
function validateInputs() {
    const phaseData = collectPhaseData();
    const isValid = validateAllPhases(phaseData);
    
    generateButton.disabled = !isValid;
    
    if (isValid) {
        generateButton.classList.remove('disabled');
    } else {
        generateButton.classList.add('disabled');
    }
}

/**
 * Save individual phase data for the current date
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} weekday - Day of the week
 * @param {Array} phaseData - Array of phase data objects
 * @returns {Promise<boolean>} - Success status
 */
async function savePhaseData(date, weekday, phaseData) {
    try {
        // Get existing data for today
        const existingData = await getTodayData(date);
        
        // Merge new phase data with existing data
        const updatedPhases = { ...existingData.phases };
        
        phaseData.forEach(phase => {
            if (phase.status) {
                updatedPhases[`phase${phase.phase}`] = {
                    status: phase.status,
                    productivity: phase.productivity || '',
                    timestamp: new Date().toISOString(),
                    locked: true
                };
            }
        });
        
        // Calculate total score from all phases
        const allPhases = Object.values(updatedPhases);
        const totalScore = calculateScoreFromPhaseObjects(allPhases);
        const color = getColorForScore(totalScore);
        
        // Save updated data
        const dataToSave = {
            date: date,
            weekday: weekday,
            phases: updatedPhases,
            score: totalScore,
            color: color,
            timestamp: new Date().toISOString()
        };
        
        return await saveDailyData(date, weekday, totalScore, color, updatedPhases);
        
    } catch (error) {
        console.error('Error saving phase data:', error);
        return false;
    }
}

/**
 * Get today's existing data
 * @param {string} date - Date in YYYY-MM-DD format
 * @returns {Promise<Object>} - Today's data or empty structure
 */
async function getTodayData(date) {
    try {
        const allData = await fetchAllData();
        const todayData = allData.find(item => item.date === date);
        
        return todayData || {
            phases: {},
            score: 0,
            color: '#f0f0f0'
        };
    } catch (error) {
        console.error('Error getting today data:', error);
        return { phases: {}, score: 0, color: '#f0f0f0' };
    }
}

/**
 * Calculate score from phase objects
 * @param {Array} phases - Array of phase objects
 * @returns {number} - Total score
 */
function calculateScoreFromPhaseObjects(phases) {
    let totalScore = 0;
    
    phases.forEach(phase => {
        if (phase.status) {
            const statusScore = SCORING.status[phase.status] || 0;
            
            if (phase.status === 'failed') {
                totalScore += 0;
            } else {
                const productivityScore = SCORING.productivity[phase.productivity] || 0;
                totalScore += statusScore + productivityScore;
            }
        }
    });
    
    return Math.min(100, Math.max(0, totalScore));
}

/**
 * Lock saved phases by disabling their dropdowns
 * @param {string} date - Current date
 */
async function lockSavedPhases(date) {
    try {
        const todayData = await getTodayData(date);
        
        Object.keys(todayData.phases || {}).forEach(phaseKey => {
            const phaseNumber = phaseKey.replace('phase', '');
            const phaseData = todayData.phases[phaseKey];
            
            if (phaseData.locked) {
                const statusSelect = document.querySelector(`.status-dropdown[data-phase="${phaseNumber}"]`);
                const productivitySelect = document.querySelector(`.productivity-dropdown[data-phase="${phaseNumber}"]`);
                
                if (statusSelect && productivitySelect) {
                    // Set values
                    statusSelect.value = phaseData.status;
                    productivitySelect.value = phaseData.productivity;
                    
                    // Lock them
                    statusSelect.disabled = true;
                    productivitySelect.disabled = true;
                    statusSelect.style.opacity = '0.7';
                    productivitySelect.style.opacity = '0.7';
                    
                    // Add locked styling
                    statusSelect.parentElement.style.position = 'relative';
                    if (!statusSelect.parentElement.querySelector('.locked-indicator')) {
                        const lockedIndicator = document.createElement('span');
                        lockedIndicator.className = 'locked-indicator';
                        lockedIndicator.innerHTML = '🔒';
                        lockedIndicator.style.position = 'absolute';
                        lockedIndicator.style.right = '5px';
                        lockedIndicator.style.top = '50%';
                        lockedIndicator.style.transform = 'translateY(-50%)';
                        lockedIndicator.style.pointerEvents = 'none';
                        statusSelect.parentElement.appendChild(lockedIndicator);
                    }
                }
            }
        });
    } catch (error) {
        console.error('Error locking phases:', error);
    }
}

/**
 * Update heatmap with current color
 * @param {string} date - Date
 * @param {string} weekday - Weekday
 * @param {number} score - Score
 * @param {string} color - Color
 */
async function updateHeatmapColor(date, weekday, score, color) {
    try {
        await saveDailyData(date, weekday, score, color);
    } catch (error) {
        console.error('Error updating heatmap:', error);
    }
}

/**
 * Load today's phases and lock them if they exist
 */
async function loadTodayPhases() {
    try {
        const today = formatDate(new Date());
        const todayData = await getTodayData(today);
        
        if (todayData.phases) {
            // Restore and lock saved phases
            Object.keys(todayData.phases).forEach(phaseKey => {
                const phaseNumber = phaseKey.replace('phase', '');
                const phaseData = todayData.phases[phaseKey];
                
                const statusSelect = document.querySelector(`.status-dropdown[data-phase="${phaseNumber}"]`);
                const productivitySelect = document.querySelector(`.productivity-dropdown[data-phase="${phaseNumber}"]`);
                
                if (statusSelect && productivitySelect && phaseData.locked) {
                    // Restore values
                    statusSelect.value = phaseData.status;
                    productivitySelect.value = phaseData.productivity || '';
                    
                    // Lock dropdowns
                    statusSelect.disabled = true;
                    productivitySelect.disabled = true;
                    statusSelect.style.opacity = '0.7';
                    productivitySelect.style.opacity = '0.7';
                    
                    // Add locked indicator
                    statusSelect.parentElement.style.position = 'relative';
                    const lockedIndicator = document.createElement('span');
                    lockedIndicator.className = 'locked-indicator';
                    lockedIndicator.innerHTML = '🔒';
                    lockedIndicator.style.position = 'absolute';
                    lockedIndicator.style.right = '5px';
                    lockedIndicator.style.top = '50%';
                    lockedIndicator.style.transform = 'translateY(-50%)';
                    lockedIndicator.style.pointerEvents = 'none';
                    lockedIndicator.style.fontSize = '12px';
                    statusSelect.parentElement.appendChild(lockedIndicator);
                }
            });
            
            // Update button text to show current score
            const currentScore = todayData.score || 0;
            if (currentScore > 0) {
                generateButton.textContent = `Current Score: ${currentScore}/100 - Add More`;
            }
        }
    } catch (error) {
        console.error('Error loading today phases:', error);
    }
}

/**
 * Clear all form inputs
 */
function clearForm() {
    const dropdowns = document.querySelectorAll('select');
    dropdowns.forEach(dropdown => {
        dropdown.selectedIndex = 0;
    });
    validateInputs();
}

/**
 * Show success or error message
 * @param {string} message - Message to display
 * @param {string} type - Message type ('success' or 'error')
 */
function showMessage(message, type = 'success') {
    // Remove existing messages
    const existingMessages = document.querySelectorAll('.success-message, .error-message');
    existingMessages.forEach(msg => msg.remove());
    
    // Create new message
    const messageElement = document.createElement('div');
    messageElement.className = type === 'success' ? 'success-message' : 'error-message';
    messageElement.textContent = message;
    
    // Insert after the generate button
    const buttonContainer = document.querySelector('.button-container');
    buttonContainer.insertAdjacentElement('afterend', messageElement);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
        messageElement.remove();
    }, 5000);
}

/**
 * Format date as YYYY-MM-DD
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDate(date) {
    return date.toISOString().split('T')[0];
}

/**
 * Format date for display
 * @param {Date} date - Date object
 * @returns {string} Formatted date string
 */
function formatDateForDisplay(date) {
    return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
    });
}

/**
 * Get weekday name
 * @param {Date} date - Date object
 * @returns {string} Weekday name
 */
function getWeekday(date) {
    return date.toLocaleDateString('en-US', { weekday: 'long' });
}

/**
 * Register service worker for PWA functionality
 */
function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js')
            .then(registration => {
                console.log('Service worker registered successfully:', registration);
            })
            .catch(error => {
                console.log('Service worker registration failed:', error);
            });
    } else {
        console.log('Service workers not supported');
    }
}

/**
 * Check if app can be installed (PWA)
 */
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    console.log('PWA install prompt available');
    deferredPrompt = e;
    
    // Show install button or notification if desired
    // This is optional - browsers will show their own install UI
});

window.addEventListener('appinstalled', (evt) => {
    console.log('PWA was installed');
    showMessage('App installed successfully!', 'success');
});

// Initialize app when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initializeApp);
} else {
    initializeApp();
}

// Handle offline/online status
window.addEventListener('online', () => {
    console.log('App is online');
    showMessage('Back online! Data will sync with Firebase.', 'success');
});

window.addEventListener('offline', () => {
    console.log('App is offline');
    showMessage('App is offline. Data will be saved locally.', 'info');
});

// Export functions for debugging
window.ProductivityTracker = {
    collectPhaseData,
    calculateProductivityScore,
    getColorForScore,
    loadHeatmapData,
    clearForm
};