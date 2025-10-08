// Firebase configuration and Firestore integration
// Replace YOUR_FIREBASE_CONFIG_HERE with your actual Firebase config

// Import Firebase modules
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js';
import { 
    getFirestore, 
    collection, 
    doc, 
    setDoc, 
    getDocs, 
    orderBy, 
    query 
} from 'https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js';

// Firebase configuration object
// Your actual Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD_xTlgcPDPIKDO0OhSfQX7h6LpUcxhlaU",
    authDomain: "productivity-tracker-32eb8.firebaseapp.com",
    projectId: "productivity-tracker-32eb8",
    storageBucket: "productivity-tracker-32eb8.firebasestorage.app",
    messagingSenderId: "937575950529",
    appId: "1:937575950529:web:a26c3671436a542a620c40",
    measurementId: "G-RG1V0W46T7"
};

// Initialize Firebase
let app;
let db;

try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    console.log('Firebase initialized successfully');
} catch (error) {
    console.error('Firebase initialization error:', error);
    // Fallback to localStorage if Firebase fails
    console.log('Falling back to localStorage for data persistence');
}

/**
 * Save daily productivity data to Firebase Firestore
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} weekday - Day of the week (e.g., 'Monday')
 * @param {number} score - Productivity score (0-100)
 * @param {string} color - Hex color code representing the score
 * @param {Object} phases - Optional phases data
 * @returns {Promise<boolean>} - Success status
 */
export async function saveDailyData(date, weekday, score, color, phases = null) {
    try {
        if (!db) {
            // Fallback to localStorage
            return saveToLocalStorage(date, weekday, score, color, phases);
        }

        // Reference to the user's consistency collection
        const docRef = doc(db, 'users', 'defaultUser', 'consistency', date);
        
        // Data to save
        const data = {
            date: date,
            weekday: weekday,
            score: score,
            color: color,
            timestamp: new Date()
        };
        
        // Add phases data if provided
        if (phases) {
            data.phases = phases;
        }
        
        // Save to Firestore
        await setDoc(docRef, data);
        console.log('Data saved successfully to Firebase:', data);
        
        return true;
    } catch (error) {
        console.error('Error saving to Firebase:', error);
        
        // Fallback to localStorage
        return saveToLocalStorage(date, weekday, score, color);
    }
}

/**
 * Fetch all productivity data from Firebase Firestore
 * @returns {Promise<Array>} - Array of daily data objects
 */
export async function fetchAllData() {
    try {
        if (!db) {
            // Fallback to localStorage
            return fetchFromLocalStorage();
        }

        // Reference to the user's consistency collection
        const consistencyRef = collection(db, 'users', 'defaultUser', 'consistency');
        
        // Query to get all documents ordered by date
        const q = query(consistencyRef, orderBy('date', 'desc'));
        
        // Get all documents
        const querySnapshot = await getDocs(q);
        
        const data = [];
        querySnapshot.forEach((doc) => {
            data.push({
                id: doc.id,
                ...doc.data()
            });
        });
        
        console.log('Data fetched successfully from Firebase:', data.length, 'records');
        return data;
        
    } catch (error) {
        console.error('Error fetching from Firebase:', error);
        
        // Fallback to localStorage
        return fetchFromLocalStorage();
    }
}

/**
 * Fallback function to save data to localStorage
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} weekday - Day of the week
 * @param {number} score - Productivity score
 * @param {string} color - Hex color code
 * @param {Object} phases - Optional phases data
 * @returns {boolean} - Success status
 */
function saveToLocalStorage(date, weekday, score, color, phases = null) {
    try {
        const existingData = JSON.parse(localStorage.getItem('productivityData') || '{}');
        
        const dataEntry = {
            date: date,
            weekday: weekday,
            score: score,
            color: color,
            timestamp: new Date().toISOString()
        };
        
        // Add phases data if provided
        if (phases) {
            dataEntry.phases = phases;
        }
        
        existingData[date] = dataEntry;
        
        localStorage.setItem('productivityData', JSON.stringify(existingData));
        console.log('Data saved to localStorage:', dataEntry);
        
        return true;
    } catch (error) {
        console.error('Error saving to localStorage:', error);
        return false;
    }
}

/**
 * Fallback function to fetch data from localStorage
 * @returns {Array} - Array of daily data objects
 */
function fetchFromLocalStorage() {
    try {
        const data = JSON.parse(localStorage.getItem('productivityData') || '{}');
        const dataArray = Object.values(data);
        
        // Sort by date descending
        dataArray.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        console.log('Data fetched from localStorage:', dataArray.length, 'records');
        return dataArray;
        
    } catch (error) {
        console.error('Error fetching from localStorage:', error);
        return [];
    }
}

/**
 * Check if Firebase is properly configured
 * @returns {boolean} - True if Firebase is configured
 */
export function isFirebaseConfigured() {
    return db !== null && firebaseConfig.apiKey !== "demo-api-key";
}

/**
 * Get Firebase connection status
 * @returns {string} - Connection status message
 */
export function getConnectionStatus() {
    if (!db) {
        return "Using localStorage (Firebase not available)";
    } else if (!isFirebaseConfigured()) {
        return "Using localStorage (Firebase not configured)";
    } else {
        return "Connected to Firebase";
    }
}

// Export Firebase instances for debugging
export { app, db };