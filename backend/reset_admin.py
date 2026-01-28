from sqlmodel import Session, select
from app.core.database import engine
from app.models.models import User
from app.core.auth import get_password_hash

def reset_admin():
    with Session(engine) as session:
        # Check if admin exists
        statement = select(User).where(User.username == "admin")
        admin = session.exec(statement).first()
        
        hashed_password = get_password_hash("admin123")
        
        if admin:
            print(f"Updating existing admin password...")
            admin.hashed_password = hashed_password
            session.add(admin)
        else:
            print(f"Creating new admin user...")
            new_admin = User(
                username="admin",
                email="admin@example.com",
                hashed_password=hashed_password,
                is_active=True,
                is_superuser=True
            )
            session.add(new_admin)
        
        session.commit()
        print("Admin user reset successfully! Username: admin, Password: admin123")

if __name__ == "__main__":
    reset_admin()
