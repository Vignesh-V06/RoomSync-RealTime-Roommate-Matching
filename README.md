# RoomSync 🏠

RoomSync is a modern, real-time web application designed to help university students find the perfect roommates and manage room applications. By leveraging a custom compatibility scoring system and real-time communication tools, it eliminates the hassle of finding compatible peers to share a dorm or apartment with...

## ✨ Features

- **Smart Compatibility Matching:** Discover vacant rooms sorted by how well your living preferences (sleep schedule, cleanliness, study habits, diet) align with the room owner's lifestyle.
- **Application Workflow:** Apply to rooms seamlessly. Room owners get a dedicated dashboard to review applicant profiles and choose to Accept or Reject them.
- **Application History:** Keep track of all the rooms you applied to with a live, color-coded status board (Pending, Accepted, Rejected) directly on your profile.
- **Real-Time Group Chat:** Once accepted, applicants are automatically dropped into a WhatsApp-style real-time chat dashboard alongside the room owner to plan their move-in. 
- **Live Notifications:** Never miss an update! Instant toast notifications pop up on your screen the exact second your room application is accepted or rejected.
- **Dynamic Dark Mode:** A stunning, fully responsive UI that seamlessly toggles between visually rich light and dark themes...

## 🛠️ Tech Stack

### Frontend
- **React.js** (via Vite)
- **Tailwind CSS** (for beautiful, utility-first styling)
- **React Router** (for SPA navigation)
- **Socket.io-client** (for real-time messaging)
- **React Hot Toast** (for sleek in-app notifications)

### Backend
- **Node.js & Express.js** (REST API framework)
- **Socket.io** (Websocket server for real-time events)
- **MySQL2** (Relational database management)
- **JWT & Bcrypt** (Secure authentication and password hashing)

## 🚀 Getting Started

Follow these steps to get your local development environment up and running.

### 1. Clone & Install
Open your terminal and install dependencies for both the frontend and backend.
```bash
# Install backend dependencies
cd backend
npm install

# Install frontend dependencies
cd ../frontend
npm install
```

### 2. Database Setup
1. Make sure you have **MySQL** installed and running on your machine.
2. In the `backend/` folder, open or create a `.env` file and insert your MySQL credentials:
   ```env
   PORT=5000
   JWT_SECRET=roomsync_super_secret_key
   DB_HOST=localhost
   DB_USER=root
   DB_PASSWORD=your_mysql_password
   DB_NAME=roomsync
   ```
3. Run the provided database initialization scripts (`schema.sql` and `seed.sql`) in your MySQL workbench or CLI to build the tables and populate mock data.

### 3. Run the Application
You need to run both the Frontend and the Backend servers simultaneously.

**Terminal 1 (Backend):**
```bash
cd backend
node server.js
# Or use 'npm run dev' if you have nodemon installed
```

**Terminal 2 (Frontend):**
```bash
cd frontend
npm run dev
```

Visit the local URL provided by Vite (usually `http://localhost:5173`) in your browser to start matching!

## 🤝 Current Status
This project is currently actively tailored for local testing (simulated password resets, mocked email flows) and operates specifically under VIT Vellore campus logic, but is highly extensible for production deployment.
