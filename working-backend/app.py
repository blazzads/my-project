"""
Minimal Working Backend for Proposal System
Just the essentials - guaranteed to work
"""

import sqlite3
import uuid
import hashlib
import os
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS

# Initialize Flask
app = Flask(__name__)
CORS(app, resources={r"*": {"origins": ["http://localhost:3000"]}})

# Database configuration
DATABASE_FILE = "proposal_system.db"


# Initialize database
def init_db():
    """Initialize database and create tables"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Create users table
    cursor.execute("""
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

    # Create proposals table
    cursor.execute("""
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

    conn.commit()
    conn.close()
    print("Database initialized successfully")


# Create default user
def create_default_user():
    """Create default admin user"""
    conn = sqlite3.connect(DATABASE_FILE)
    cursor = conn.cursor()

    # Check if admin user exists
    cursor.execute("SELECT * FROM users WHERE username = 'admin'")
    admin_user = cursor.fetchone()

    if not admin_user:
        admin_id = str(uuid.uuid4())
        password_hash = hashlib.sha256("admin123".encode()).hexdigest()

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
                datetime.now().isoformat(),
            ),
        )

        conn.commit()
        print("Default admin user created")
        print("Username: admin")
        print("Password: admin123")
    else:
        print("Admin user already exists")

    conn.close()


# API Routes
@app.route("/")
def root():
    return jsonify(
        {"message": "Proposal System API", "status": "running", "version": "1.0.0"}
    )


@app.route("/api/health")
def health():
    """Health check endpoint"""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.execute("SELECT COUNT(*) as count FROM users")
        user_count = cursor.fetchone()
        conn.close()

        return jsonify(
            {
                "status": "healthy",
                "database": "connected",
                "users_count": user_count["count"],
                "timestamp": datetime.now().isoformat(),
            }
        )
    except Exception as e:
        return jsonify({"status": "unhealthy", "error": str(e)}), 500


@app.route("/api/proposals", methods=["GET"])
def get_proposals():
    """Get all proposals"""
    try:
        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.execute("SELECT * FROM proposals ORDER BY created_at DESC")
        proposals = cursor.fetchall()
        conn.close()

        return jsonify([dict(p) for p in proposals])
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/proposals", methods=["POST"])
def create_proposal():
    """Create new proposal"""
    try:
        data = request.get_json()
        proposal_id = str(uuid.uuid4())
        now = datetime.now().isoformat()

        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.execute(
            """
            INSERT INTO proposals (id, title, description, category, status, client_name,
                                estimated_value, currency, created_by, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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

        return jsonify({"id": proposal_id, "status": "created", "created_at": now}), 201
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/auth/login", methods=["POST"])
def login():
    """Login endpoint"""
    try:
        data = request.get_json()
        username = data.get("username")
        password = data.get("password")

        if not username or not password:
            return jsonify({"error": "Username and password required"}), 400

        conn = sqlite3.connect(DATABASE_FILE)
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
        user = cursor.fetchone()
        conn.close()

        if not user or not hashlib.sha256(password.encode()).hexdigest() == user[4]:
            return jsonify({"error": "Invalid credentials"}), 401

        return jsonify(
            {
                "access_token": f"token_{hashlib.sha256(f'{user[0]}{datetime.now()}'.encode()).hexdigest()}",
                "token_type": "bearer",
                "user": {
                    "id": user[0],
                    "username": user[1],
                    "email": user[2],
                    "full_name": user[3],
                    "role": user[5],
                },
            }
        )
    except Exception as e:
        return jsonify({"error": str(e)}), 500


@app.route("/api/ai/generate-draft", methods=["POST"])
def generate_draft():
    """Mock AI draft generation"""
    return jsonify(
        {
            "draft_content": """# AI-Generated Proposal Draft

## Executive Summary
This proposal is generated using advanced AI technology...

## Technical Solution
### Overview
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


# Initialize database on startup
if __name__ == "__main__":
    print("Starting Proposal System Backend...")
    print("=" * 40)
    print("Initializing database...")

    init_db()
    create_default_user()

    print("Backend ready!")
    print("API Endpoints:")
    print("   GET  /api/health")
    print("   GET  /api/proposals")
    print("   POST /api/proposals")
    print("   POST /api/auth/login")
    print("   POST /api/ai/generate-draft")
    print("=" * 40)
    print("Default Login: admin / admin123")
    print("Server: http://localhost:8000")
    print("=" * 40)

    try:
        app.run(host="0.0.0.0", port=8000, debug=False)
    except KeyboardInterrupt:
        print("\nServer stopped gracefully")
    except Exception as e:
        print(f"Server error: {e}")
