// Auth Server — port 3006
// Handles login, logout, and session verification.
// Sessions are stored in-memory (simple token map).

import express from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import { findUserByCredentials, findUserById } from './data/usersStore.js';

const app = express();
const PORT = 3006;

app.use(cors());
app.use(express.json());

// In-memory session store: token -> { userId, fullName, username, createdAt }
const sessions = new Map();

// POST /auth/login
app.post('/auth/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'נדרש שם משתמש וסיסמה' });
  }

  const user = findUserByCredentials(username, password);
  if (!user) {
    return res.status(401).json({ success: false, error: 'שם משתמש או סיסמה שגויים' });
  }

  const token = uuidv4();
  sessions.set(token, {
    userId: user.id,
    fullName: user.fullName,
    username: user.username,
    createdAt: new Date().toISOString()
  });

  console.log(`🔑 Login: ${user.username} (${user.fullName})`);

  res.json({
    success: true,
    data: {
      token,
      userId: user.id,
      fullName: user.fullName,
      username: user.username
    }
  });
});

// POST /auth/logout
app.post('/auth/logout', (req, res) => {
  const token = req.headers['x-auth-token'] || req.body?.token;
  if (token && sessions.has(token)) {
    const session = sessions.get(token);
    console.log(`👋 Logout: ${session.username}`);
    sessions.delete(token);
  }
  res.json({ success: true, message: 'התנתקת בהצלחה' });
});

// GET /auth/me — verify token and return current user
app.get('/auth/me', (req, res) => {
  const token = req.headers['x-auth-token'];
  if (!token || !sessions.has(token)) {
    return res.status(401).json({ success: false, error: 'לא מחובר' });
  }
  const session = sessions.get(token);
  res.json({ success: true, data: session });
});

app.get('/health', (req, res) => {
  res.json({ status: 'Auth Server is running', activeSessions: sessions.size });
});

app.listen(PORT, () => {
  console.log(`✅ Auth Server running on http://localhost:${PORT}`);
  console.log(`   POST /auth/login`);
  console.log(`   POST /auth/logout`);
  console.log(`   GET  /auth/me`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${PORT} is already in use.`);
  } else {
    console.error('❌ Auth Server failed to start:', err.message);
  }
  process.exit(1);
});
