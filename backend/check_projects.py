import sqlite3
from datetime import datetime

def check_projects():
    try:
        conn = sqlite3.connect('database.db')
        cursor = conn.cursor()
        
        print("--- Checking All Projects in Database ---")
        cursor.execute("SELECT id, name, user_id, updated_at, length(chat_history) FROM project ORDER BY updated_at DESC")
        projects = cursor.fetchall()
        
        if not projects:
            print("No projects found in database.")
        else:
            for p in projects:
                p_id, name, uid, updated, chat_len = p
                print(f"ID: {p_id} | Name: {name} | User: {uid} | Updated: {updated} | Chat History Len: {chat_len}")
                
        print("\n--- Checking Users ---")
        cursor.execute("SELECT id, username FROM user")
        users = cursor.fetchall()
        for u in users:
            print(f"User ID: {u[0]} | Username: {u[1]}")
            
        conn.close()
    except Exception as e:
        print(f"Error checking database: {e}")

if __name__ == "__main__":
    check_projects()
