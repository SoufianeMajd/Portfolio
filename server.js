/* ============================================
   Portfolio Backend — Express + SQLite (sql.js)
   Stores contact form messages
   ============================================ */

require('dotenv').config();
const express = require('express');
const initSqlJs = require('sql.js');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const rateLimit = require('express-rate-limit');
const xss = require('xss');

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

// ---------- Security & General Middleware ----------
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    next();
});

app.use(connectLivereload());
app.use(cors({ origin: ['https://soufianemajd.github.io', 'http://localhost:3000'] }));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- Security Helper: Timing Safe Equal String Comparison ---
function safeCompare(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        crypto.timingSafeEqual(bufA, bufA);
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

// --- Session Store (Token -> Expiry Timestamp) ---
const activeSessions = new Map();

function createAdminSession() {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + 4 * 60 * 60 * 1000; // 4 heures
    activeSessions.set(token, expiresAt);
    return { token, expiresAt };
}

function isValidAdminToken(token) {
    if (!token) return false;
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';
    if (safeCompare(token, ADMIN_PASSWORD)) return true;

    if (activeSessions.has(token)) {
        const expiresAt = activeSessions.get(token);
        if (Date.now() < expiresAt) {
            return true;
        }
        activeSessions.delete(token);
    }
    return false;
}

// --- Rate Limiting ---
const apiLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 10, // limit each IP to 10 submissions per hour
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Trop de requêtes, veuillez réessayer plus tard.' }
});

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // max 5 tentatives échouées
    standardHeaders: true,
    legacyHeaders: false,
    message: { success: false, error: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.' }
});

const adminAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Non autorisé: Token manquant' });
    }
    const token = authHeader.substring(7).trim();
    if (!isValidAdminToken(token)) {
        return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }
    next();
};

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
app.post('/api/messages', apiLimiter, (req, res) => {
    let { name, email, message } = req.body;

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

    // Sanitization
    name = xss(name.trim());
    email = xss(email.trim());
    message = xss(message.trim());

    try {
        db.run(
            'INSERT INTO messages (name, email, message) VALUES (?, ?, ?)',
            [name, email, message]
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
app.get('/api/messages', adminAuth, (req, res) => {
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
app.patch('/api/messages/:id/read', adminAuth, (req, res) => {
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
app.delete('/api/messages/:id', adminAuth, (req, res) => {
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
app.get('/api/messages/stats', adminAuth, (req, res) => {
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

// ---------- Admin Authentication Routes ----------

// POST /api/admin/login — Authenticate admin and return session token
app.post('/api/admin/login', loginLimiter, (req, res) => {
    const { password } = req.body || {};
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

    if (!password || !safeCompare(password, ADMIN_PASSWORD)) {
        return res.status(401).json({
            success: false,
            error: 'Mot de passe incorrect'
        });
    }

    const session = createAdminSession();
    console.log('🔐 Connexion réussie à l\'interface administrateur');

    res.json({
        success: true,
        message: 'Authentification réussie',
        token: session.token,
        expiresAt: session.expiresAt
    });
});

// POST /api/admin/logout — Invalidate current admin session
app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7).trim();
        activeSessions.delete(token);
    }
    res.json({ success: true, message: 'Déconnexion réussie' });
});

// GET /api/admin/verify — Check if the client token is still valid
app.get('/api/admin/verify', adminAuth, (req, res) => {
    res.json({ success: true, authenticated: true });
});

// ---------- Start Server ----------
initDatabase().then(() => {
    app.listen(PORT, () => {
        console.log(`\n🚀 Portfolio server running at http://localhost:${PORT}`);
        console.log(`📬 Admin panel at http://localhost:${PORT}/admin.html`);
        if (!process.env.ADMIN_PASSWORD) {
            console.warn('⚠️  SÉCURITÉ : Aucun ADMIN_PASSWORD défini dans .env, mot de passe par défaut "admin123" actif.');
            console.warn('👉 Créez un fichier .env avec ADMIN_PASSWORD=votre_mot_de_passe_securise\n');
        } else {
            console.log('🔒 Authentification admin configurée avec mot de passe personnalisé\n');
        }
    });
}).catch(err => {
    console.error('❌ Failed to initialize database:', err);
    process.exit(1);
});
