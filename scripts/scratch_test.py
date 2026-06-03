import asyncio
from sqlalchemy.ext.asyncio import AsyncSession
from backend.database.database import AsyncSessionLocal
from backend.models.models import User, DPP, Attempt
from backend.routes.tracking import submit_dpp
from backend.schemas.schemas import AttemptCreate

async def main():
    async with AsyncSessionLocal() as db:
        # Get student Michael (user_id=4)
        student = await db.get(User, 4)
        print("Student:", student.name, student.email)
        
        # Get DPP 7
        dpp = await db.get(DPP, 7)
        print("DPP:", dpp.title)
        
        # Construct attempt create data
        attempt_data = AttemptCreate(
            dpp_id=7,
            questions_attempted=4,
            correct_questions=3,
            time_spent=120,
            completed=True
        )
        
        # Call submit_dpp
        try:
            res = await submit_dpp(attempt_data, db, student)
            print("Submit Success:", res)
            print("Attempt in DB after submit:", res.questions_attempted, res.correct_questions, res.time_spent)
        except Exception as e:
            print("Error in submit_dpp:", e)

if __name__ == "__main__":
    asyncio.run(main())
