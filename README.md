# ↗ Lost & Found Portal — Full-Stack Web Application

A modern, responsive, and secure campus/workplace Lost and Found web application featuring machine learning TF-IDF cosine similarity search, real-time messaging, and audio call simulation.

Built with a **Node.js + Express** backend, **MongoDB Atlas** database, **bcrypt** password hashing, **JSON Web Token (JWT)** authentication, and a **Render** free deployment setup.

---

## 🏗️ Architecture

```
lost-and-found-portal/
├── index.html            # Frontend UI (Responsive, glassmorphism, ML search)
├── styles.css            # Dark sleek theme and UI styling
├── server.js             # Express REST API & MongoDB Atlas database models
├── package.json          # Node.js dependencies & scripts
├── .env                  # Local secret environment variables (ignored by Git)
├── .env.example          # Environment variables template
├── .gitignore            # Git ignore rule (prevents leaking secrets & node_modules)
└── README.md             # Complete setup & deployment guide
```

### 🔒 Secure Credentials & Data Storage
- **Credentials Security**: Passwords are never stored in plain text. They are hashed using **bcrypt** (with 10 salt rounds) before saving to the MongoDB database.
- **Session Authentication**: Uses signed **JSON Web Tokens (JWT)** for stateless, tamper-proof user authentication.
- **Database Collections (MongoDB Atlas)**:
  - `users`: User profiles, email, unique userId, role, and encrypted passwords.
  - `items`: All lost and found product reports, category, place, date, description, status, and reporter info.
  - `messages`: Chat messages exchanged between students/staff for coordinating handovers.

---

## 🗄️ Step 1: Create Your Free MongoDB Atlas Database

MongoDB Atlas provides a **forever-free 512MB M0 cluster** (no credit card required):

1. **Sign Up**:
   - Visit [mongodb.com/cloud/atlas/register](https://www.mongodb.com/cloud/atlas/register) and sign up for a free account.
2. **Create a Free Cluster**:
   - Select **M0 (Free)** under shared clusters.
   - Choose a cloud provider and region closest to you (e.g. AWS / us-east-1 or ap-south-1).
   - Click **Create Deployment**.
3. **Set Up Security & Credentials**:
   - **Database User**: Create a username (e.g., `admin`) and a password (e.g., `SecurePass2026!`). *Make sure to note down this password.*
   - **Network Access**: Add IP Address `0.0.0.0/0` (Allow Access from Anywhere) so both your local machine and Render servers can connect.
4. **Get the Connection String**:
   - Click **Database** in the sidebar → Click **Connect**.
   - Select **Drivers** (Node.js).
   - Copy the connection string format:
     ```text
     mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/lostandfound?retryWrites=true&w=majority
     ```
   - Replace `<username>` and `<password>` with your database user credentials.
5. **Add to `.env`**:
   - Open the [.env](file:///c:/Users/mayan/OneDrive/Documents/lost%20and%20found%20mini%20project/.env) file in your project folder.
   - Paste your connection string:
     ```env
     PORT=5000
     MONGODB_URI=mongodb+srv://admin:SecurePass2026!@cluster0.xxxxx.mongodb.net/lostandfound?retryWrites=true&w=majority
     JWT_SECRET=lost_and_found_super_secret_jwt_key_2026
     ```

---

## 💻 Step 2: Run Locally on Your Computer

1. Open your terminal in this project directory:
   ```bash
   npm install
   ```
2. Start the server:
   ```bash
   npm start
   ```
3. Open your browser and navigate to:
   ```text
   http://localhost:5000
   ```
4. You will see:
   ```text
   🚀 Lost & Found Portal running on http://localhost:5000
   ✅ Connected to MongoDB Atlas successfully.
   ```

*(Note: If you run without a MongoDB connection string, the server automatically runs in in-memory fallback mode so you can test immediately).*

---

## 🚀 Step 3: Deploy Online for Free on Render.com

Render offers **100% free web service hosting** with automated SSL/HTTPS and continuous deployment from GitHub:

### A. Push Code to GitHub
1. Create a new repository on [github.com/new](https://github.com/new) named `lost-and-found-portal` (set to **Public** or **Private**).
2. In your terminal, run:
   ```bash
   git add .
   git commit -m "Initial commit of full-stack lost and found application"
   git branch -M main
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/lost-and-found-portal.git
   git push -u origin main
   ```

### B. Deploy on Render
1. Go to [render.com](https://render.com) and sign in with your GitHub account.
2. In the Render Dashboard, click **New +** → **Web Service**.
3. Select your `lost-and-found-portal` repository from GitHub.
4. Fill in the configuration:
   - **Name**: `lost-and-found-portal` (or any custom name)
   - **Region**: Choose the closest region
   - **Branch**: `main`
   - **Root Directory**: Leave blank (default)
   - **Runtime**: `Node`
   - **Build Command**: `npm install`
   - **Start Command**: `node server.js`
   - **Instance Type**: **Free**
5. Scroll down to **Environment Variables** and add:
   - `MONGODB_URI`: (Your full MongoDB connection string)
   - `JWT_SECRET`: (A secure random string, e.g. `prod_secret_token_key_9988`)
   - `NODE_ENV`: `production`
6. Click **Deploy Web Service**.

Within 2 to 3 minutes, Render will build and deploy your application. You will receive a live URL:
`https://lost-and-found-portal.onrender.com`

---

## 📡 REST API Documentation

| Method | Endpoint | Description | Auth Required |
|---|---|---|---|
| `GET` | `/api/health` | Service health status & DB connection check | No |
| `POST` | `/api/auth/register` | Register new user with bcrypt-hashed password | No |
| `POST` | `/api/auth/login` | Authenticate user & receive JWT token | No |
| `GET` | `/api/auth/me` | Fetch currently logged-in user profile | Yes (Bearer Token) |
| `GET` | `/api/items` | Retrieve all registered lost and found items | No |
| `POST` | `/api/items` | Submit a new lost or found item report | Yes (Bearer Token) |
| `DELETE` | `/api/items/:id` | Remove an item report (Owner or Staff) | Yes (Bearer Token) |
| `GET` | `/api/chat/:itemId` | Retrieve conversation thread for an item | No |
| `POST` | `/api/chat/:itemId` | Send a new message to the reporter | Yes (Bearer Token) |
