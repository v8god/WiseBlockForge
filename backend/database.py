import sqlite3
import os
import hashlib
import secrets
import json
from datetime import datetime, timedelta

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "wiseblockforge.db")

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE,
        password_hash TEXT,
        google_id TEXT UNIQUE,
        email TEXT UNIQUE,
        kaggle_username TEXT,
        kaggle_key TEXT
    )
    """)
    
    # Create Workflows Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS workflows (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        name TEXT,
        nodes TEXT,
        edges TEXT,
        is_pinned INTEGER DEFAULT 0,
        is_public INTEGER DEFAULT 0,
        last_saved TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    # Create Sessions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS sessions (
        token TEXT PRIMARY KEY,
        user_id TEXT,
        expires_at TEXT,
        FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
    """)
    
    conn.commit()
    conn.close()

# Password Hashing Utilities (using standard pbkdf2)
def hash_password(password: str) -> str:
    salt = os.urandom(16)
    pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
    return salt.hex() + "$" + pw_hash.hex()

def verify_password(password: str, hashed: str) -> bool:
    if not hashed or "$" not in hashed:
        return False
    try:
        salt_hex, hash_hex = hashed.split("$", 1)
        salt = bytes.fromhex(salt_hex)
        pw_hash = hashlib.pbkdf2_hmac('sha256', password.encode('utf-8'), salt, 100000)
        return pw_hash.hex() == hash_hex
    except Exception:
        return False

# User Auth Core Functions
def register_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    user_id = secrets.token_hex(8)
    pw_hash = hash_password(password)
    try:
        cursor.execute(
            "INSERT INTO users (id, username, password_hash) VALUES (?, ?, ?)",
            (user_id, username, pw_hash)
        )
        conn.commit()
        return {"id": user_id, "username": username}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def authenticate_user(username, password):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE username = ?", (username,))
    row = cursor.fetchone()
    conn.close()
    if row and verify_password(password, row["password_hash"]):
        return dict(row)
    return None

def create_session(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    token = secrets.token_hex(24)
    expires = (datetime.utcnow() + timedelta(days=7)).isoformat()
    cursor.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires)
    )
    conn.commit()
    conn.close()
    return token

def get_user_by_session(token):
    if not token:
        return None
    conn = get_db_connection()
    cursor = conn.cursor()
    # Cleanup expired sessions first
    now = datetime.utcnow().isoformat()
    cursor.execute("DELETE FROM sessions WHERE expires_at < ?", (now,))
    conn.commit()
    
    cursor.execute("""
        SELECT users.* FROM users 
        JOIN sessions ON users.id = sessions.user_id 
        WHERE sessions.token = ?
    """, (token,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return dict(row)
    return None

def logout_session(token):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()
    conn.close()

# Google Sign-in Integrations
def login_or_create_google_user(google_id, email, name):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM users WHERE google_id = ? OR email = ?", (google_id, email))
    row = cursor.fetchone()
    
    if row:
        user_id = row["id"]
        # If they registered via password earlier, link google account
        if not row["google_id"]:
            cursor.execute("UPDATE users SET google_id = ? WHERE id = ?", (google_id, user_id))
            conn.commit()
    else:
        user_id = secrets.token_hex(8)
        # Use email suffix or name for username fallback if needed
        username = email.split("@")[0] + "_" + secrets.token_hex(2)
        cursor.execute(
            "INSERT INTO users (id, username, google_id, email) VALUES (?, ?, ?, ?)",
            (user_id, username, google_id, email)
        )
        conn.commit()
        
    conn.close()
    return user_id

# Kaggle Credentials Operations
def save_kaggle_credentials(user_id, kaggle_username, kaggle_key):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE users SET kaggle_username = ?, kaggle_key = ? WHERE id = ?",
        (kaggle_username, kaggle_key, user_id)
    )
    conn.commit()
    conn.close()

# Workflow Operations
def save_workflow(user_id, wf_id, name, nodes, edges, is_pinned=0, is_public=0, last_saved=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    if not last_saved:
        last_saved = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        
    # Check if workflow exists
    cursor.execute("SELECT id FROM workflows WHERE id = ? AND user_id = ?", (wf_id, user_id))
    row = cursor.fetchone()
    
    nodes_json = json.dumps(nodes)
    edges_json = json.dumps(edges)
    
    if row:
        cursor.execute("""
            UPDATE workflows 
            SET name = ?, nodes = ?, edges = ?, is_pinned = ?, is_public = ?, last_saved = ? 
            WHERE id = ? AND user_id = ?
        """, (name, nodes_json, edges_json, int(is_pinned), int(is_public), last_saved, wf_id, user_id))
    else:
        cursor.execute("""
            INSERT INTO workflows (id, user_id, name, nodes, edges, is_pinned, is_public, last_saved) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        """, (wf_id, user_id, name, nodes_json, edges_json, int(is_pinned), int(is_public), last_saved))
        
    conn.commit()
    conn.close()

def get_user_workflows(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workflows WHERE user_id = ? ORDER BY is_pinned DESC, last_saved DESC", (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "name": r["name"],
            "nodes": json.loads(r["nodes"]),
            "edges": json.loads(r["edges"]),
            "isPinned": bool(r["is_pinned"]),
            "isPublic": bool(r["is_public"]),
            "lastSaved": r["last_saved"]
        })
    return result

def delete_workflow(user_id, wf_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("DELETE FROM workflows WHERE id = ? AND user_id = ?", (wf_id, user_id))
    conn.commit()
    conn.close()

def publish_workflow(user_id, wf_id, is_public):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE workflows SET is_public = ? WHERE id = ? AND user_id = ?", (int(is_public), wf_id, user_id))
    conn.commit()
    conn.close()

def get_community_workflows():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM workflows WHERE is_public = 1 ORDER BY last_saved DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for r in rows:
        result.append({
            "id": r["id"],
            "name": r["name"],
            "nodes": json.loads(r["nodes"]),
            "edges": json.loads(r["edges"]),
            "isPinned": bool(r["is_pinned"]),
            "isPublic": bool(r["is_public"]),
            "lastSaved": r["last_saved"]
        })
    return result

# Initialize DB on load
init_db()
