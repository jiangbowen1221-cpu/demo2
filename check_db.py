from sqlmodel import Session, create_engine, select
from app.models.models import Project
import os

database_url = "sqlite:///backend/database.db"
engine = create_engine(database_url)

with Session(engine) as session:
    projects = session.exec(select(Project)).all()
    print(f"Total projects in DB: {len(projects)}")
    for p in projects:
        print(f"ID: {p.id}, Name: {p.name}, User ID: {p.user_id}")
