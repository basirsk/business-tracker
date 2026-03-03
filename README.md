# Business Tracker

A standalone daily business tracking web app built with **React + Tailwind CSS + Firebase**.

## Features
- 🔐 Email/Password + Google OAuth login
- 📊 Dashboard with 4 live-total cards (Vendor, Investor, Expense, Sales)
- 📋 Per-section history with add & delete
- 💾 Firebase Firestore persistence
- 📱 Fully mobile-responsive

## Setup

### 1. Install dependencies
```bash
npm install
```

### 2. Configure Firebase
Copy `.env.example` → `.env.local` and fill in your Firebase credentials:
```bash
cp .env.example .env.local
```
Then edit `.env.local` with values from your [Firebase Console](https://console.firebase.google.com).

### 3. Firebase Firestore Rules
In your Firebase Console → Firestore → Rules, add:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /bt_users/{uid} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /bt_transactions/{doc} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.uid;
      allow create: if request.auth != null && request.auth.uid == request.resource.data.uid;
    }
  }
}
```

### 4. Run locally
```bash
npm run dev
```

### 5. Build for production
```bash
npm run build
```

## Project Structure
```
src/
├── pages/
│   ├── Login.jsx         # Sign in (email + Google)
│   ├── Signup.jsx        # Register (email + Google)
│   ├── Dashboard.jsx     # 4-card overview
│   └── SectionDetail.jsx # History + new entry form
├── hooks/
│   └── useAuthState.js   # Firebase auth state hook
├── firebase.js           # Firebase init
├── App.jsx               # Routes + guards
└── main.jsx              # Entry point
```
