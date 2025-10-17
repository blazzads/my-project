from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import sqlite3, os

app = FastAPI(title="Proposal Management System")
DB_PATH = os.getenv("DB_PATH", "./database/proposal_system.db")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def root():
    return {"message": "✅ Backend up & running with LiteFS!"}

@app.get("/proposals")
def get_proposals():
    conn = sqlite3.connect(DB_PATH)
    cur = conn.cursor()
    cur.execute("CREATE TABLE IF NOT EXISTS proposals (id INTEGER PRIMARY KEY, title TEXT)")
    cur.execute("SELECT * FROM proposals")
    rows = cur.fetchall()
    conn.close()
    return {"data": rows}
