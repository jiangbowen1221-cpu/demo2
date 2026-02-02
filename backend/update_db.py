import sqlite3

def add_column():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    try:
        cursor.execute("ALTER TABLE project ADD COLUMN chat_history TEXT DEFAULT '[]'")
        print("Successfully added chat_history column.")
    except sqlite3.OperationalError as e:
        print(f"Error (probably column already exists): {e}")
        
    conn.commit()
    conn.close()

if __name__ == "__main__":
    add_column()
