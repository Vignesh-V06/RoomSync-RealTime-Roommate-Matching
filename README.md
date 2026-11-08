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


## RoomSync platform features and local setup

The current Harbor Blue feature branch includes weighted compatibility matching, optional owner-defined room criteria, one room listing per owner, one active application or membership per student, room-specific chat access, room detail views, owner analytics and administrator overview metrics.

### Updating an existing database

Back up the database first. The migration adds account contact fields, custom compatibility preferences, room status and photo/view tables, and unique constraints. Review and resolve any duplicate room owners or users with multiple active requests (status applied or accepted) first; the migration contains example queries in its comments.

```bash
mysql -u YOUR_DB_USER -p roomsync < backend/migrations/2026-11-06-platform-features.sql
```

For a new local database, create the latest schema instead:

```bash
mysql -u YOUR_DB_USER -p < backend/schema.sql
```

Do not run the migration after importing the updated schema; choose the path that matches your database.

### Bootstrap the administrator account

The admin role is granted only by the database-backed seed script. Configure these values in the backend's private .env file or the hosting provider's secret settings. Use a unique password of at least 14 characters; do not commit .env files or share the value.

```env
ADMIN_EMAIL=admin.v@gmail.com
ADMIN_PASSWORD=use-a-unique-long-password
ADMIN_NAME=RoomSync Administrator
ADMIN_USERNAME=admin.v
```

Then run:

```bash
cd backend
npm install
npm run seed:admin
```

The administrator analytics screen is served at /admin. Both the frontend route and the /api/admin/analytics endpoint check the account role; changing browser local storage is not sufficient to grant access.



### Admin analytics and activity event tracking

The administrator API and report downloads require both a valid session and a database-backed `admin` role. The admin dashboard supports 3-month, 12-month (default), and all-available-history views. Excel exports contain Overview, Users, Rooms, Applications, Monthly Trends, Top Rooms, Hostel Blocks and Activity sheets. CSV exports are available per dataset.

For an existing database, take a backup and run this migration once:

```bash
mysql -u YOUR_DB_USER -p roomsync < backend/migrations/2026-11-08-activity-events.sql
```

For a new database, the latest `backend/schema.sql` already includes `activity_events`.

Activity logging intentionally excludes passwords, OTPs, message contents, email contents and phone numbers. The event log begins only after this migration and application version are deployed. Older registration, room, application, view and message totals are still derived from their existing tables; historic login/event detail cannot be reconstructed.

The reporting endpoints are under `/api/admin` and are protected by the server-side admin middleware:
- `GET /api/admin/analytics?range=12m`
- `GET /api/admin/reports/export?format=xlsx&range=12m`
- `GET /api/admin/reports/export?format=csv&dataset=users&range=12m`

CSV datasets: `overview`, `users`, `rooms`, `applications`, `monthly`, `top_rooms`, `blocks`, `activity`. Export rows are capped at 20,000 per dataset. Reports contain limited account identifiers needed for administration and must be handled as confidential data.

### Verified email OTP password reset

The password-reset flow sends a six-digit code through Resend. Codes are stored only as keyed hashes, expire after 10 minutes, are single-use, and are locked after five incorrect attempts. Requests are throttled per account and by source IP.

For an existing database, take a backup and run this migration once:

```bash
mysql -u YOUR_DB_USER -p roomsync < backend/migrations/2026-11-08-password-reset-otp.sql
```

For a new database, the latest `backend/schema.sql` already includes the OTP table.

Configure these values in your private `backend/.env` file (never commit them):

```env
RESEND_API_KEY=re_your_private_api_key
RESEND_FROM_EMAIL=RoomSync <auth@your-verified-domain.com>
PASSWORD_RESET_OTP_SECRET=generate-a-separate-random-32-byte-secret
```

Create a Resend account, generate an API key, add a domain you own, and verify its DNS records before using that domain in `RESEND_FROM_EMAIL`. Resend requires at least one verified domain for sending. The API call uses Bearer authentication and the transactional email endpoint.

Generate a separate OTP secret from the backend folder with Node.js:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Restart the backend after updating `.env`. Existing sample/test accounts are not changed by this feature; password reset will only deliver to a real mailbox when that exact email exists on the account and the Resend sender is configured correctly. Check the backend logs and Resend email logs when delivery fails.

### Photo storage note

Room photos are currently stored in MySQL with a five-photo limit and a 4 MB per-image limit. This keeps local setup simple. Before a high-traffic production launch, move image binaries to S3 or another object store and keep only their metadata and storage keys in MySQL.
