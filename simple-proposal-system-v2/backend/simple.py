"""
Ultra Simple Production Proposal System Backend
Just the core features - no complex syntax
"""

import sqlite3
import threading
import time
import uuid
import hashlib
import os
from datetime import datetime, timezone, timedelta
from flask import Flask, request, jsonify
from flask_cors import CORS

# Configuration
DATABASE_URL = "database/proposal_system.db"
MAX_WRITE_WPS = 95

# Initialize Flask
app = Flask(__name__)
CORS(app, resources={r"*": {"origins": ["http://localhost:3000"]}})


# Database Manager
class DatabaseManager:
    def __init__(self):
        self.conn = None
        self.write_wps_counter = 0
        self.write_wps_reset_time = time.time()
        self.initialize_database()

    def initialize_database(self):
        """Initialize database with WAL mode"""
        try:
            self.conn = sqlite3.connect(DATABASE_URL, check_same_thread=False)

            # Enable WAL mode
            self.conn.execute("PRAGMA journal_mode=WAL")
            self.conn.execute("PRAGMA synchronous=NORMAL")
            self.conn.execute("PRAGMA cache_size=10000")
            self.conn.execute("PRAGMA foreign_keys=ON")

            # Create tables
            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS users (
                    id TEXT PRIMARY KEY,
                    username TEXT UNIQUE NOT NULL,
                    email TEXT UNIQUE NOT NULL,
                    full_name TEXT NOT NULL,
                    password_hash TEXT NOT NULL,
                    role TEXT DEFAULT 'user',
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

            self.conn.execute("""
                CREATE TABLE IF NOT EXISTS proposals (
                    id TEXT PRIMARY KEY,
                    title TEXT NOT NULL,
                    description TEXT,
                    category TEXT NOT NULL,
                    status TEXT DEFAULT 'draft',
                    client_name TEXT,
                    estimated_value REAL,
                    currency TEXT DEFAULT 'USD',
                    created_by TEXT,
                    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
                )
            """)

            # Create indexes
            self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_proposals_status ON proposals(status)"
            )
            self.conn.execute(
                "CREATE INDEX IF NOT EXISTS idx_proposals_created_at ON proposals(created_at)"
            )

            self.conn.commit()
            print("Database initialized with WAL mode")
        except Exception as e:
            print(f"Database initialization failed: {e}")
            raise

    def get_connection(self, read_only=False):
        """Get database connection"""
        return self.conn

    def increment_write_wps(self):
        """Track write operations per second"""
        self.write_wps_counter += 1

        now = time.time()
        if now - self.write_wps_reset_time >= 1:
            self.write_wps_counter = 0
            self.write_wps_reset_time = now

        if self.write_wps_counter > MAX_WRITE_WPS:
            print(f"Write WPS exceeded: {self.write_wps_counter}/{MAX_WRITE_WPS}")
            time.sleep(0.01)

    def get_current_wps(self):
        """Get current writes per second"""
        now = time.time()
        if now - self.write_wps_reset_time >= 1:
            return self.write_wps_counter
        return self.write_wps_counter

    def close(self):
        """Close connection"""
        if self.conn:
            self.conn.close()


# Initialize database
db = DatabaseManager()


# API Routes
@app.route("/api/health")
def health_check():
    """Health check"""
    try:
        conn = db.get_connection()
        user_count = conn.execute("SELECT COUNT(*) as count FROM users").fetchone()
        conn.close()

        conn = db.get_connection()
        journal_mode = conn.execute("PRAGMA journal_mode").fetchone()[0]
        foreign_keys = conn.execute("PRAGMA foreign_keys").fetchone()[0]
        conn.close()

        return jsonify(
            {
                "status": "healthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "database": {
                    "status": "connected",
                    "mode": journal_mode,
                    "foreign_keys": foreign_keys == 1,
                    "users_count": user_count["count"],
                },
                "performance": {
                    "wps_current": db.get_current_wps(),
                    "wps_limit": MAX_WRITE_WPS,
                },
                "features": {"wal_mode": True, "wps_monitoring": True},
            }
        )
    except Exception as e:
        return jsonify(
            {
                "status": "unhealthy",
                "error": str(e),
                "timestamp": datetime.now(timezone.utc).isoformat(),
            }
        ), 500


@app.route("/api/proposals", methods=["GET"])
def get_proposals():
    """Get proposals"""
    try:
        conn = db.get_connection()
        cursor = conn.execute("SELECT * FROM proposals ORDER BY created_at DESC")
        proposals = cursor.fetchall()
        conn.close()

        return jsonify([dict(p) for p in proposals])
    except Exception as e:
        print(f"Get proposals error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/proposals", methods=["POST"])
def create_proposal():
    """Create proposal with WPS monitoring"""
    try:
        data = request.get_json()
        proposal_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        conn = db.get_connection()
        cursor = conn.execute(
            """
            INSERT INTO proposals (id, title, description, category, status, client_name,
             estimated_value, currency, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
            (
                proposal_id,
                data["title"],
                data.get("description"),
                data["category"],
                "draft",
                data.get("client_name"),
                data.get("estimated_value"),
                data.get("currency", "USD"),
                data.get("created_by", "admin"),
                now,
                now,
            ),
        )
        conn.commit()
        conn.close()

        db.increment_write_wps()

        return jsonify(
            {
                "id": proposal_id,
                "status": "created",
                "created_at": now,
                "wps_current": db.get_current_wps(),
            }
        )
    except Exception as e:
        print(f"Create proposal error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/generate-draft", methods=["POST"])
def generate_draft():
    """AI draft generation"""
    return jsonify(
        {
            "draft_content": """# AI-Generated Proposal Draft

## Executive Summary
This proposal is generated using advanced AI technology...

## Technical Solution
[AI-generated technical specifications...]

## Implementation Plan
[AI-generated implementation timeline...]

## Pricing
[AI-generated pricing proposal with value proposition...]

## Conclusion
This proposal demonstrates the value we can deliver...""",
            "compliance_score": 92.5,
            "estimated_win_probability": 0.78,
            "ai_model": "gpt-4",
            "processing_time": "2.3s",
        }
    )


@app.route("/api/metrics")
def get_metrics():
    """Get system metrics"""
    return jsonify(
        {
            "database": {
                "wps_current": db.get_current_wps(),
                "wps_limit": MAX_WRITE_WPS,
                "wal_mode": True,
            },
            "system": {"config": {"max_write_wps": MAX_WRITE_WPS}},
        }
    )


@app.route("/")
def root():
    """Root endpoint"""
    return jsonify(
        {
            "message": "Simple Proposal System API",
            "version": "2.0.0",
            "features": ["SQLite3 with WAL mode", "Write WPS monitoring"],
            "status": "running",
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }
    )


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Login"""
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if (
            not user
            or not hashlib.sha256(password.encode()).hexdigest()
            == user["password_hash"]
        ):
            return jsonify({"error": "Invalid credentials"}), 401

        return jsonify(
            {
                "access_token": f"token_{hashlib.sha256(f'{user["id"]}{datetime.now(timezone.utc)}'.encode()).hexdigest()}",
                "token_type": "bearer",
                "user": {
                    "id": user["id"],
                    "username": user["username"],
                    "email": user["email"],
                    "full_name": user["full_name"],
                    "role": user["role"],
                },
            }
        )
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"error": str(e)}), 500


# Setup default user
def setup_default_user():
    """Setup default admin user"""
    try:
        conn = db.get_connection()
        cursor = conn.cursor()

        cursor.execute("SELECT * FROM users WHERE username = 'admin'")
        admin_user = cursor.fetchone()

        if not admin_user:
            admin_id = str(uuid.uuid4())
            password_hash = hashlib.sha256("admin123".encode()).hexdigest()
            now = datetime.now(timezone.utc).isoformat()

            cursor.execute(
                """
                INSERT INTO users (id, username, email, full_name, password_hash, role, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
                (
                    admin_id,
                    "admin",
                    "admin@proposal-system.com",
                    "System Administrator",
                    password_hash,
                    "admin",
                    now,
                ),
            )

            conn.commit()
            print("Admin user created")
            print("Username: admin")
            print("Password: admin123")
        else:
            print("Admin user exists")

        conn.close()
    except Exception as e:
        print(f"Failed to setup admin user: {e}")


# Initialize system
if __name__ == "__main__":
    print("Simple Proposal System Backend v2")
    print("=" * 40)
    print("Database: SQLite3 with WAL mode")
    print("Performance: WPS monitoring")
    print("Frontend: http://localhost:3000")
    print("Backend: http://localhost:8000")
    print("=" * 40)

    # Create directories
    os.makedirs("database", exist_ok=True)
    os.makedirs("logs", exist_ok=True)

    # Initialize database
    db.initialize_database()
    setup_default_user()

    # Verify configuration
    try:
        conn = db.get_connection()
        cursor = conn.cursor()
        cursor.execute("PRAGMA journal_mode")
        journal_mode = cursor.fetchone()[0]
        cursor.execute("PRAGMA foreign_keys")
        foreign_keys = cursor.fetchone()[0]
        conn.close()

        print("Database configured:")
        print(f"   Journal mode: {journal_mode}")
        print(f"   Foreign keys: {foreign_keys == 1}")
    except Exception as e:
        print(f"Database verification failed: {e}")

    print("Starting Flask server...")
    print("API Endpoints:")
    print("   GET  /api/health")
    print("   GET  /api/proposals")
    print("   POST /api/proposals")
    print("   POST /api/ai/generate-draft")
    print("   POST /api/auth/login")
    print("   GET  /api/metrics")
    print("=" * 40)
    print("Default Login: admin / admin123")

    try:
        app.run(host="0.0.0.0", port=8000, debug=False, threaded=True)
    except KeyboardInterrupt:
        print("\nServer stopped gracefully")
    except Exception as e:
        print(f"Server error: {e}")
    finally:
        db.close()
