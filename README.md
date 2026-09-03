# Damage Report Management System - MVP

A minimal, functional damage report management system with backend API and frontend interface.

## Features

✅ **Reports List** - View all damage reports  
✅ **Create Report** - Add new damage reports  
✅ **Report Details** - View complete report information  
✅ **Status Management** - Change report status (NEW → IN_REVIEW)  
✅ **In-Memory Storage** - Simple, no database setup needed  
✅ **RESTful API** - All required endpoints implemented  

## System Architecture

```
damage-reports-system/
├── backend/
│   └── server.js           # Express API server
├── frontend/
│   └── index.html          # Single-page web interface
├── package.json            # Dependencies
└── README.md
```

## Data Model

### DamageReport Entity
```javascript
{
  id: string,              // Unique identifier (UUID)
  reporterName: string,    // Name of person reporting damage
  address: string,         // Location of damage
  damageType: string,      // Type of damage
  description: string,     // Detailed description
  status: enum,            // NEW or IN_REVIEW
  createdAt: timestamp,    // When report was created
  updatedAt?: timestamp    // When last updated
}
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/reports` | List all reports |
| `POST` | `/reports` | Create a new report |
| `GET` | `/reports/{id}` | Get report details |
| `PATCH` | `/reports/{id}/status` | Update report status |
| `GET` | `/health` | Health check |

### Example Requests

**Create Report:**
```bash
curl -X POST http://localhost:3001/reports \
  -H "Content-Type: application/json" \
  -d '{
    "reporterName": "John Doe",
    "address": "123 Main St",
    "damageType": "Water Damage",
    "description": "Roof leak in bedroom"
  }'
```

**Update Status:**
```bash
curl -X PATCH http://localhost:3001/reports/[REPORT_ID]/status \
  -H "Content-Type: application/json" \
  -d '{ "status": "IN_REVIEW" }'
```

## Setup & Running

### Prerequisites
- Node.js 18+ installed
- npm package manager

### Installation

1. Navigate to project directory:
```bash
cd damage-reports-system
```

2. Install dependencies:
```bash
npm install
```

### Running the System

#### Option 1: Terminal (Recommended for testing)

1. Start backend server:
```bash
npm run dev
```

You should see:
```
✅ Damage Reports API Server running on http://localhost:3001
   GET  /reports
   POST /reports
   GET  /reports/:id
   PATCH /reports/:id/status
```

2. Open `frontend/index.html` in your browser:
   - Click the file in Windows Explorer, or
   - Open browser and go to: `file:///[FULL_PATH]/damage-reports-system/frontend/index.html`

3. The system is now ready to use!

#### Option 2: Using VS Code Tasks

1. Create/update `.vscode/tasks.json` in workspace root with task to run `npm run dev`
2. Press `Ctrl+Shift+B` to build and run

## Usage Guide

### View All Reports
1. Click **"Reports List"** tab
2. All damage reports display as cards
3. Click any card to view full details

### Create New Report
1. Click **"Create Report"** tab
2. Fill in all required fields:
   - Reporter Name
   - Address
   - Damage Type (dropdown)
   - Description
3. Click **"Create Report"** button
4. System shows success message and loads the new report

### View Report Details
1. **Method 1:** Click any report card from list
2. **Method 2:** Go to "Report Details" tab, paste report ID, click "Load"
3. View all report information and status

### Change Report Status
1. Open report details (see above)
2. Select new status from dropdown (NEW or IN_REVIEW)
3. Click **"Update Status"** button
4. Status updates immediately

## Demo Data

System comes with 3 sample reports pre-loaded:
- John Smith - Water Damage (NEW)
- Jane Doe - Structural Damage (IN_REVIEW)
- Bob Johnson - Fire Damage (NEW)

## Technical Details

### Backend (Express.js)
- **Framework:** Express.js
- **Storage:** In-memory JavaScript array
- **CORS:** Enabled for frontend access
- **Validation:** Input validation on all endpoints
- **Error Handling:** JSON error responses

### Frontend (Vanilla HTML/JS)
- **Architecture:** Single-page application (SPA)
- **Styling:** Inline CSS (no build step needed)
- **API Communication:** Fetch API
- **Navigation:** Tab-based interface

## Limitations & Future Enhancements

### Current Limitations
- ⚠️ Data reset on server restart (in-memory only)
- ⚠️ Single server instance (no clustering)
- ⚠️ No authentication or authorization
- ⚠️ No file uploads

### Possible Enhancements
- [ ] Persistent database (SQLite, PostgreSQL)
- [ ] User authentication
- [ ] Report filtering/searching
- [ ] Damage photos upload
- [ ] Export to PDF/CSV
- [ ] Email notifications
- [ ] Advanced reporting dashboard

## Troubleshooting

### Port 3001 already in use
```bash
# Windows - Kill process on port 3001
netstat -ano | findstr :3001
taskkill /PID [PID] /F

# macOS/Linux
lsof -i :3001
kill -9 [PID]
```

### Frontend can't reach API
- Ensure backend is running (`npm run dev`)
- Check browser console for errors (F12)
- Verify API URL is `http://localhost:3001`

### CORS errors in browser console
- Backend has CORS enabled
- Check that API server is running
- Browser may cache old requests - do hard refresh (Ctrl+Shift+R)

## Project Statistics

- **Total Files:** 4
- **Backend Code:** ~120 lines
- **Frontend Code:** ~450 lines
- **Setup Time:** < 5 minutes
- **Total Endpoints:** 5
- **Statuses:** 2 (NEW, IN_REVIEW)
- **Damage Types:** 6 predefined + custom

---

**Status:** ✅ Production-Ready MVP  
**Last Updated:** 2025-06-21  
**Version:** 1.0.0
