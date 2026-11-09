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

### Full-room closure and roommate removal

For an existing database, back up the database and run this migration once after the platform-features migration:

```bash
mysql -u YOUR_DB_USER -p roomsync < backend/migrations/2026-11-09-room-capacity-membership.sql
```

For a new database, the latest `backend/schema.sql` already includes the `removed` application status. A room automatically closes when its final bed is occupied. Owners can remove accepted roommates from the owner dashboard; the membership record is retained as `removed`, the freed bed becomes available again, and the former member's room-chat access is revoked. A manually closed, non-full listing stays closed.

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

RoomSync sends six-digit password-reset codes through a selectable email provider. Codes are stored only as keyed hashes, expire after 10 minutes, are single-use, and are locked after five incorrect attempts. Requests are throttled per account and by source IP.

For an existing database, take a backup and run this migration once:

```bash
mysql -u YOUR_DB_USER -p roomsync < backend/migrations/2026-11-08-password-reset-otp.sql
```

For a new database, the latest `backend/schema.sql` already includes the OTP table.

#### Local development with Gmail SMTP

Use a dedicated development Gmail account where practical. This is a development/testing option, not a production mail service. Enable Google 2-Step Verification, then create an App Password:

1. Sign in to the Google account that will send RoomSync emails.
2. Open [Google Account Security](https://myaccount.google.com/security).
3. Under **How you sign in to Google**, select **2-Step Verification** and complete setup.
4. Open [Google App Passwords](https://myaccount.google.com/apppasswords).
5. Enter an app name such as `RoomSync Local Development`, create the password, and copy the 16-character value immediately.
6. If the App Password page is unavailable, the account may be using a security-key-only 2-Step Verification setup, Advanced Protection, or a managed work/school account whose administrator restricts App Passwords. Use an eligible personal Google Account for local development instead.

Configure these values in your private `backend/.env` file. Keep your existing MySQL credentials, `JWT_SECRET`, and `PASSWORD_RESET_OTP_SECRET`. Do not commit or share this file:

```env
EMAIL_PROVIDER=gmail
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your-development-account@gmail.com
SMTP_APP_PASSWORD=your-16-character-google-app-password
SMTP_FROM_EMAIL=
PASSWORD_RESET_OTP_SECRET=your-existing-separate-random-secret
```

Leave `SMTP_FROM_EMAIL` blank to send from the authenticated Gmail account. The App Password is not your normal Google account password. RoomSync strips spaces from the copied App Password before SMTP authentication. Gmail SMTP uses `smtp.gmail.com:587` with STARTTLS; port 465 with implicit TLS is also supported by setting `SMTP_PORT=465` and `SMTP_SECURE=true`.

After editing `.env`, restart the backend. On the Forgot Password page, click **Check email setup**. The local check verifies MySQL and the OTP table, then checks Gmail SMTP authentication if the credentials are present. It does not send a test email. Once the SMTP check passes, request an OTP for a RoomSync account whose registered email is a real inbox you can access.

Google's App Password guidance: [Create and use App Passwords](https://support.google.com/mail/answer/185833). SMTP settings: `smtp.gmail.com`, port 587 with TLS/STARTTLS. Gmail can impose account-level sending limits or block suspicious automated sign-ins, so use this only for local, low-volume testing.

#### Optional Resend provider

Resend remains supported for later production use. Verify a domain you own in Resend, then configure:

```env
EMAIL_PROVIDER=resend
RESEND_API_KEY=re_your_private_api_key
RESEND_FROM_EMAIL=RoomSync <auth@your-verified-domain.com>
PASSWORD_RESET_OTP_SECRET=your-separate-random-32-byte-secret
```

Resend's `onboarding@resend.dev` sender is for restricted testing to the email address associated with the Resend account. A verified sender domain is required to deliver to other recipients. See the provider's current sending-domain documentation before production.

The same OTP routes and database table are used by both providers. Existing sample/test accounts are unchanged; password reset delivers only to the email address stored on the account. Never log or export OTP values, app passwords, API keys, or message contents.

### Photo storage note

Room photos are currently stored in MySQL with a five-photo limit and a 4 MB per-image limit. This keeps local setup simple. Before a high-traffic production launch, move image binaries to S3 or another object store and keep only their metadata and storage keys in MySQL.
