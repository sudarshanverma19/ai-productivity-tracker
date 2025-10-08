# AI Productivity Tracker

A Progressive Web App for tracking daily productivity with AI-powered insights and visual heatmaps.

## 🎯 Features

- **5-Phase Daily Tracking**: Track status and productivity for 5 daily phases
- **Smart Scoring System**: Each phase contributes up to 20 points (10 status + 10 productivity)
- **Phase Locking**: Once saved, phases are locked for that day until midnight
- **30-Day Heatmap**: Visual representation of your productivity consistency
- **PWA Capabilities**: Installable, works offline, responsive design
- **Firebase Integration**: Real-time data sync with Firestore
- **Green Color Scheme**: Positive visualization with green color variations

## 🚀 Scoring System

### Status Points:
- **Passed**: 10 points
- **Failed**: 0 points (productivity dropdown disabled)
- **Other Important Work**: 10 points
- **Intentionally Declined**: 10 points

### Productivity Points:
- **Highly Productive**: 10 points
- **Productive**: 8 points
- **Average**: 6 points
- **Below Average**: 4 points
- **Least Productive**: 2 points

**Maximum Score**: 100 points (5 phases × 20 points each)

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+ modules)
- **Backend**: Firebase Firestore
- **PWA**: Service Worker, Web App Manifest
- **Storage**: Firebase with localStorage fallback
- **Styling**: Modern CSS with responsive design

## 📁 Project Structure

```
ProductivityApp/
├── index.html          # Main application interface
├── style.css           # Modern UI styling
├── app.js             # Core application logic
├── firebase-config.js  # Firebase integration
├── manifest.json      # PWA configuration
├── sw.js              # Service worker for offline support
└── icons/
    ├── icon-192.png   # PWA icon (192x192)
    ├── icon-512.png   # PWA icon (512x512)
    ├── icon-192.svg   # SVG source
    └── icon-512.svg   # SVG source
```

## 🔧 Setup & Installation

### Prerequisites
- Node.js (for development server)
- Firebase project with Firestore enabled

### Local Development
1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd ProductivityApp
   ```

2. Configure Firebase:
   - Update `firebase-config.js` with your Firebase config
   - Enable Firestore in your Firebase console

3. Serve the application:
   ```bash
   python -m http.server 8000
   # or
   npx serve .
   ```

4. Open: `http://localhost:8000`

### Firebase Deployment
1. Install Firebase CLI:
   ```bash
   npm install -g firebase-tools
   ```

2. Login and initialize:
   ```bash
   firebase login
   firebase init hosting
   ```

3. Deploy:
   ```bash
   firebase deploy
   ```

## 🎮 Usage

1. **Daily Tracking**: Select status and productivity for each phase
2. **Generate Color**: Click to save and lock selected phases
3. **Progressive Saving**: Add more phases throughout the day
4. **View Progress**: Check your 30-day consistency heatmap
5. **Offline Support**: Works without internet connection

## 🔒 Phase Locking System

- Once a phase is saved, it displays a 🔒 icon and becomes uneditable
- Locked phases persist until the next day (automatic daily reset)
- Score accumulates as you add more phases throughout the day

## 🎨 Color System

The app uses green color variations to represent productivity levels:
- **No Data**: Light gray
- **1-20 points**: Lightest green
- **21-40 points**: Light green
- **41-60 points**: Medium green
- **61-80 points**: Dark green
- **81-100 points**: Darkest green

## 📱 PWA Features

- **Installable**: Add to home screen on mobile/desktop
- **Offline First**: Cached resources work without internet
- **Responsive**: Optimized for all screen sizes
- **Fast Loading**: Service worker caching for instant loads

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature-name`
3. Commit changes: `git commit -m 'Add feature'`
4. Push to branch: `git push origin feature-name`
5. Open a Pull Request

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 🔗 Links

- **Live Demo**: [Your Firebase URL]
- **Repository**: [Your GitHub URL]
- **Issues**: [GitHub Issues URL]

---

**Built with ❤️ for productivity enthusiasts**