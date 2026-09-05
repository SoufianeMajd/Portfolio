/* ============================================
   Portfolio Backend — Express + SQLite (sql.js)
   Stores contact form messages
   ============================================ */

const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// LiveReload Setup (Auto Refresh)
const livereload = require('livereload');
const connectLivereload = require('connect-livereload');

const liveReloadServer = livereload.createServer();
liveReloadServer.watch(path.join(__dirname, 'public'));
liveReloadServer.server.once("connection", () => {
  setTimeout(() => {
    liveReloadServer.refresh("/");
  }, 100);
});

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.join(__dirname, 'messages.db');

// ---------- Middleware ----------
app.use(connectLivereload());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (index.html, style.css, script.js, etc.)
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Database Setup ----------
let db;

function saveDatabase() {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
}

async function initDatabase() {
    const SQL = await initSqlJs();

    // Load existing database or create a new one
    if (fs.existsSync(DB_PATH)) {
        const fileBuffer = fs.readFileSync(DB_PATH);
        db = new SQL.Database(fileBuffer);
    } else {
        db = new SQL.Database();
    }

    // Create messages table if it doesn't exist
    db.run(`
        CREATE TABLE IF NOT EXISTS messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            message TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_read INTEGER DEFAULT 0
        )
    `);
    saveDatabase();

    console.log('✅ Database ready — messages table initialized');
}

// ---------- API Routes ----------

// POST /api/messages — receive a new contact message
app.post('/api/messages', (req, res) => {
    const { name, email, message } = req.body;

    // Validation
    if (!name || !email || !message) {
        return res.status(400).json({
            success: false,
            error: 'All fields are required (name, email, message)'
        });
    }

    if (name.length > 200 || email.length > 200 || message.length > 5000) {
        return res.status(400).json({
            success: false,
            error: 'Field length exceeded'
        });
    }

    // Simple email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.status(400).json({
            success: false,
            error: 'Invalid email format'
        });
    }

    try {
        db.run(
            'INSERT INTO messages (name, email, message) VALUES (?, ?, ?)',
            [name.trim(), email.trim(), message.trim()]
        );
        saveDatabase();

        const result = db.exec('SELECT last_insert_rowid() as id');
        const lastId = result[0].values[0][0];

        console.log(`📩 New message from ${name} <${email}> (ID: ${lastId})`);

        res.status(201).json({
            success: true,
            message: 'Message received successfully!',
            id: lastId
        });
    } catch (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({
            success: false,
            error: 'Server error. Please try again later.'
        });
    }
});

// GET /api/messages — retrieve all messages (for admin page)
app.get('/api/messages', (req, res) => {
    try {
        const result = db.exec('SELECT * FROM messages ORDER BY created_at DESC');

        let messages = [];
        if (result.length > 0) {
            const columns = result[0].columns;
            messages = result[0].values.map(row => {
                const obj = {};
                columns.forEach((col, i) => { obj[col] = row[i]; });
                return obj;
            });
        }

        res.json({ success: true, messages, count: messages.length });
    } catch (err) {
        console.error('❌ Database error:', err.message);
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// PATCH /api/messages/:id/read — mark message as read
app.patch('/api/messages/:id/read', (req, res) => {
    try {
        db.run('UPDATE messages SET is_read = 1 WHERE id = ?', [req.params.id]);
        const changes = db.getRowsModified();
        saveDatabase();

        if (changes === 0) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.json({ success: true, message: 'Marked as read' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// DELETE /api/messages/:id — delete a message
app.delete('/api/messages/:id', (req, res) => {
    try {
        db.run('DELETE FROM messages WHERE id = ?', [req.params.id]);
        const changes = db.getRowsModified();
        saveDatabase();

        if (changes === 0) {
            return res.status(404).json({ success: false, error: 'Message not found' });
        }

        res.json({ success: true, message: 'Message deleted' });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// GET /api/messages/stats — get message stats
app.get('/api/messages/stats', (req, res) => {
    try {
        const total = db.exec('SELECT COUNT(*) as count FROM messages');
        const unread = db.exec('SELECT COUNT(*) as count FROM messages WHERE is_read = 0');

        res.json({
            success: true,
            total: total[0].values[0][0],
            unread: unread[0].values[0][0]
        });
    } catch (err) {
        res.status(500).json({ success: false, error: 'Server error' });
    }
});

// ---------- Start Server ----------
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Portfolio server running at http://localhost:${PORT}`);
        console.log(`📬 Admin panel at http://localhost:${PORT}/admin.html\n`);
    });
}).catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
});
