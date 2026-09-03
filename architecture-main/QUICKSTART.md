# Quick Start Guide

## 🚀 Get Started in 3 Steps

### Step 1: Install Dependencies
Open PowerShell in the project folder and run:
```bash
npm install
```

### Step 2: Start the Backend Server
```bash
npm run dev
```

Wait for this message to appear:
```
✅ Damage Reports API Server running on http://localhost:3001
```

### Step 3: Open the Web Interface
Open file in browser:
```
frontend/index.html
```

**That's it! The system is live.** 🎉

---

## 📋 What You Can Do

### Tab 1: Reports List
- See all damage reports
- Click any card to view full details
- 3 demo reports included

### Tab 2: Create Report
- Fill in reporter name, address, damage type, description
- Click "Create Report"
- System creates it instantly

### Tab 3: Report Details
- View complete report information
- Change status: NEW → IN_REVIEW
- See who reported it and when

---

## 🧪 Test it Out

### Create a Report
1. Go to "Create Report" tab
2. Enter:
   - Reporter Name: `Jane Test`
   - Address: `999 Test Lane`
   - Damage Type: `Water Damage`
   - Description: `Testing the system`
3. Click "Create Report"
4. ✅ See success message

### View & Update
1. Go to "Report Details" tab
2. Paste the report ID you got
3. Click "Load"
4. Change status to "IN_REVIEW"
5. Click "Update Status"
6. ✅ Done! Check the list to confirm

---

## 🛠️ API Endpoints (For Developers)

All endpoints return JSON responses.

### Get All Reports
```bash
curl http://localhost:3001/reports
```

### Create Report
```bash
curl -X POST http://localhost:3001/reports \
  -H "Content-Type: application/json" \
  -d "{
    \"reporterName\": \"John\",
    \"address\": \"123 St\",
    \"damageType\": \"Fire Damage\",
    \"description\": \"Fire in kitchen\"
  }"
```

### Get Single Report
```bash
curl http://localhost:3001/reports/[REPORT_ID]
```

### Update Status
```bash
curl -X PATCH http://localhost:3001/reports/[REPORT_ID]/status \
  -H "Content-Type: application/json" \
  -d "{\"status\": \"IN_REVIEW\"}"
```

---

## ⚠️ Important Notes

- **Server Data:** Resets when you restart the server (data is in-memory)
- **Port:** Uses port 3001 (change in `backend/server.js` if needed)
- **Demo Data:** 3 sample reports load automatically
- **Validation:** All fields are required when creating reports

---

## 📞 If Something Doesn't Work

### API Server won't start
- Check if port 3001 is already in use
- Kill other processes on that port
- Try: `netstat -ano | findstr :3001`

### Can't see frontend
- Make sure you opened `frontend/index.html` in browser
- Check address bar shows `file://...` path

### Frontend can't reach API
- Make sure backend is running (should see ✅ in terminal)
- Do a hard refresh in browser (Ctrl+Shift+R)
- Check browser console for errors (F12)

---

**You're all set! Enjoy managing damage reports!** 😊
