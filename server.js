require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'lost_and_found_default_jwt_secret_change_me';
const MONGODB_URI = process.env.MONGODB_URI;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend static files from the current directory
app.use(express.static(path.join(__dirname)));

// -------------------------------------------------------------
// MongoDB Database Connection
// -------------------------------------------------------------
let isDbConnected = false;

if (MONGODB_URI && !MONGODB_URI.includes('<username>')) {
  mongoose.connect(MONGODB_URI)
    .then(() => {
      isDbConnected = true;
      console.log('✅ Connected to MongoDB Atlas successfully.');
    })
    .catch(err => {
      console.error('❌ MongoDB Connection Error:', err.message);
      console.log('⚠️ Running with in-memory fallback until MongoDB Atlas credentials are configured in .env');
    });
} else {
  console.log('⚠️ Notice: MONGODB_URI is not set or contains default placeholders in .env.');
  console.log('ℹ️ Local development fallback mode active. Please add your MongoDB Atlas URI in .env');
}

// -------------------------------------------------------------
// Mongoose Models
// -------------------------------------------------------------
const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true },
  email: { type: String, required: true, lowercase: true, trim: true },
  userId: { type: String, required: true, unique: true, lowercase: true, trim: true },
  accountType: { type: String, default: 'Student' },
  password: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

const itemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  title: { type: String }, // alias for name
  category: { type: String, default: 'Other' },
  type: { type: String, enum: ['lost', 'found'], required: true },
  place: { type: String, required: true },
  date: { type: String, required: true },
  details: { type: String, default: '' },
  description: { type: String, default: '' },
  reporterUserId: { type: String, required: true },
  reportedBy: { type: String, default: 'User' },
  reporterEmail: { type: String, default: '' },
  accountType: { type: String, default: 'Student' },
  status: { type: String, enum: ['open', 'resolved', 'claimed'], default: 'open' },
  reportedAt: { type: String, default: () => new Date().toLocaleDateString() },
  createdAt: { type: Date, default: Date.now }
});

// Transform _id to id in JSON output
itemSchema.set('toJSON', {
  virtuals: true,
  transform: (doc, ret) => {
    ret.id = ret._id.toString();
    if (!ret.name && ret.title) ret.name = ret.title;
    if (!ret.details && ret.description) ret.details = ret.description;
    delete ret.__v;
    return ret;
  }
});

const messageSchema = new mongoose.Schema({
  itemId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  senderName: { type: String, default: 'User' },
  text: { type: String, required: true },
  time: { type: String, default: () => new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) },
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);
const Item = mongoose.model('Item', itemSchema);
const Message = mongoose.model('Message', messageSchema);

// -------------------------------------------------------------
// Persistent Local Database Store (database.json)
// Permanently saves data across restarts
// -------------------------------------------------------------
const DB_FILE = path.join(__dirname, 'database.json');

function initDatabase() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const data = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
      return {
        users: Array.isArray(data.users) ? data.users : [],
        items: Array.isArray(data.items) ? data.items : [],
        messages: Array.isArray(data.messages) ? data.messages : []
      };
    }
  } catch (err) {
    console.error('⚠️ Could not parse database.json, initializing fresh store:', err.message);
  }
  const fresh = { users: [], items: [], messages: [] };
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(fresh, null, 2), 'utf8');
  } catch (err) {}
  return fresh;
}

const memoryStore = initDatabase();

function saveDatabase() {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(memoryStore, null, 2), 'utf8');
  } catch (err) {
    console.error('❌ Failed to save to database.json:', err.message);
  }
}

// -------------------------------------------------------------
// Authentication Middleware
// -------------------------------------------------------------
function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (err) {
    return res.status(403).json({ error: 'Invalid or expired token.' });
  }
}

// -------------------------------------------------------------
// API Endpoints: Health Check
// -------------------------------------------------------------
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: isDbConnected ? 'MongoDB Atlas (Connected)' : 'Fallback Mode (Please configure MONGODB_URI in .env)',
    timestamp: new Date()
  });
});

// -------------------------------------------------------------
// API Endpoints: Authentication
// -------------------------------------------------------------

// POST /api/auth/register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { fullName, email, userId, accountType, password } = req.body;

    if (!fullName || !email || !userId || !password) {
      return res.status(400).json({ error: 'All fields are required.' });
    }

    const cleanUserId = userId.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    if (isDbConnected) {
      const existingUser = await User.findOne({
        $or: [{ userId: cleanUserId }, { email: cleanEmail }]
      });
      if (existingUser) {
        return res.status(400).json({
          error: existingUser.userId === cleanUserId ? 'User ID is already registered.' : 'Email is already registered.'
        });
      }

      // Hash password securely with bcrypt
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      const newUser = new User({
        fullName: fullName.trim(),
        email: cleanEmail,
        userId: cleanUserId,
        accountType: accountType || 'Student',
        password: hashedPassword
      });

      await newUser.save();

      const token = jwt.sign(
        { id: newUser._id, userId: newUser.userId, email: newUser.email, fullName: newUser.fullName, accountType: newUser.accountType },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        message: 'Account created successfully!',
        token,
        user: {
          id: newUser._id,
          fullName: newUser.fullName,
          email: newUser.email,
          userId: newUser.userId,
          accountType: newUser.accountType
        }
      });
    } else {
      // Memory fallback
      const exists = memoryStore.users.find(u => u.userId === cleanUserId || u.email === cleanEmail);
      if (exists) {
        return res.status(400).json({ error: 'User ID or Email already exists.' });
      }

      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);
      const userObj = {
        id: 'mem_' + Date.now(),
        fullName: fullName.trim(),
        email: cleanEmail,
        userId: cleanUserId,
        accountType: accountType || 'Student',
        password: hashedPassword
      };
      memoryStore.users.push(userObj);
      saveDatabase();

      const token = jwt.sign(
        { id: userObj.id, userId: userObj.userId, email: userObj.email, fullName: userObj.fullName, accountType: userObj.accountType },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      return res.status(201).json({
        message: 'Account created successfully! (Memory mode)',
        token,
        user: {
          id: userObj.id,
          fullName: userObj.fullName,
          email: userObj.email,
          userId: userObj.userId,
          accountType: userObj.accountType
        }
      });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ error: 'Internal server error during registration.' });
  }
});

// POST /api/auth/login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { loginId, password } = req.body;
    if (!loginId || !password) {
      return res.status(400).json({ error: 'User ID / Email and password are required.' });
    }

    const cleanLoginId = loginId.trim().toLowerCase();

    let user = null;
    if (isDbConnected) {
      user = await User.findOne({
        $or: [{ userId: cleanLoginId }, { email: cleanLoginId }]
      });
    } else {
      user = memoryStore.users.find(u => u.userId === cleanLoginId || u.email === cleanLoginId);
    }

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const token = jwt.sign(
      { id: user._id || user.id, userId: user.userId, email: user.email, fullName: user.fullName, accountType: user.accountType },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      message: 'Login successful!',
      token,
      user: {
        id: user._id || user.id,
        fullName: user.fullName,
        email: user.email,
        userId: user.userId,
        accountType: user.accountType
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ error: 'Internal server error during login.' });
  }
});

// GET /api/auth/me
app.get('/api/auth/me', authenticateToken, (req, res) => {
  res.json({ user: req.user });
});

// -------------------------------------------------------------
// API Endpoints: Items (Lost & Found)
// -------------------------------------------------------------

// GET /api/items
app.get('/api/items', async (req, res) => {
  try {
    if (isDbConnected) {
      const items = await Item.find().sort({ createdAt: -1 });
      return res.json(items);
    } else {
      return res.json(memoryStore.items);
    }
  } catch (error) {
    console.error('Fetch Items Error:', error);
    res.status(500).json({ error: 'Failed to retrieve items.' });
  }
});

// POST /api/items
app.post('/api/items', authenticateToken, async (req, res) => {
  try {
    const { name, title, category, type, place, date, details, description } = req.body;
    const itemName = (name || title || '').trim();
    if (!itemName || !type || !place || !date) {
      return res.status(400).json({ error: 'Name, type, place, and date are required.' });
    }

    const itemData = {
      name: itemName,
      title: itemName,
      category: category || 'Other',
      type: type === 'found' ? 'found' : 'lost',
      place: place.trim(),
      date: date.trim(),
      details: (details || description || '').trim(),
      description: (details || description || '').trim(),
      reporterUserId: req.user.userId,
      reportedBy: req.user.fullName || req.user.userId,
      reporterEmail: req.user.email || '',
      accountType: req.user.accountType || 'Student',
      status: 'open',
      reportedAt: new Date().toLocaleDateString(),
      createdAt: new Date()
    };

    if (isDbConnected) {
      const newItem = new Item(itemData);
      await newItem.save();
      return res.status(201).json(newItem);
    } else {
      const memoryItem = {
        ...itemData,
        id: 'mem_item_' + Date.now()
      };
      memoryStore.items.unshift(memoryItem);
      saveDatabase();
      return res.status(201).json(memoryItem);
    }
  } catch (error) {
    console.error('Create Item Error:', error);
    res.status(500).json({ error: 'Failed to report item.' });
  }
});

// DELETE /api/items/:id
app.delete('/api/items/:id', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.id;

    if (isDbConnected) {
      const item = await Item.findById(itemId);
      if (!item) {
        return res.status(404).json({ error: 'Item not found.' });
      }

      // Check ownership
      const itemOwner = item.reporterUserId || item.reporterId;
      if (itemOwner !== req.user.userId && req.user.accountType !== 'Staff') {
        return res.status(403).json({ error: 'Unauthorized to delete this item.' });
      }

      await Item.findByIdAndDelete(itemId);
      // Clean up chat messages for this item
      await Message.deleteMany({ itemId });

      return res.json({ message: 'Item deleted successfully.' });
    } else {
      const index = memoryStore.items.findIndex(it => (it.id === itemId || it._id === itemId));
      if (index === -1) {
        return res.status(404).json({ error: 'Item not found.' });
      }

      const item = memoryStore.items[index];
      const itemOwner = item.reporterUserId || item.reporterId;
      if (itemOwner !== req.user.userId && req.user.accountType !== 'Staff') {
        return res.status(403).json({ error: 'Unauthorized to delete this item.' });
      }

      memoryStore.items.splice(index, 1);
      memoryStore.messages = memoryStore.messages.filter(m => m.itemId !== itemId);
      saveDatabase();
      return res.json({ message: 'Item deleted successfully.' });
    }
  } catch (error) {
    console.error('Delete Item Error:', error);
    res.status(500).json({ error: 'Failed to delete item.' });
  }
});

// -------------------------------------------------------------
// API Endpoints: Live Chat Messages
// -------------------------------------------------------------

// GET /api/chat/:itemId
app.get('/api/chat/:itemId', async (req, res) => {
  try {
    const itemId = req.params.itemId;
    if (isDbConnected) {
      const messages = await Message.find({ itemId }).sort({ createdAt: 1 });
      return res.json(messages);
    } else {
      const messages = memoryStore.messages.filter(m => m.itemId === itemId);
      return res.json(messages);
    }
  } catch (error) {
    console.error('Fetch Messages Error:', error);
    res.status(500).json({ error: 'Failed to fetch messages.' });
  }
});

// POST /api/chat/:itemId
app.post('/api/chat/:itemId', authenticateToken, async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: 'Message text is required.' });
    }

    const msgData = {
      itemId,
      userId: req.user.userId,
      senderName: req.user.fullName || req.user.userId,
      text: text.trim(),
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      createdAt: new Date()
    };

    if (isDbConnected) {
      const newMsg = new Message(msgData);
      await newMsg.save();
      return res.status(201).json(newMsg);
    } else {
      memoryStore.messages.push(msgData);
      saveDatabase();
      return res.status(201).json(msgData);
    }
  } catch (error) {
    console.error('Send Message Error:', error);
    res.status(500).json({ error: 'Failed to send message.' });
  }
});

// -------------------------------------------------------------
// Fallback: Serve index.html for any unhandled page routes
// -------------------------------------------------------------
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Express Server
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 Lost & Found Portal running on http://localhost:${PORT}`);
  console.log(`📁 Static files served from: ${__dirname}`);
  console.log(`📊 Health Endpoint: http://localhost:${PORT}/api/health`);
  console.log(`======================================================\n`);
});
