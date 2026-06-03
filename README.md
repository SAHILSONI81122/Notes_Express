# NotesExpress

A full-stack mobile application for coaching institutes.

## Tech Stack
- **Frontend**: React Native (Expo)
- **Backend**: FastAPI (Python)
- **Database**: PostgreSQL
- **Authentication**: JWT-based login

## Project Structure
- `backend/`: FastAPI application code
- `frontend/`: Expo React Native application code

## Setup Backend

1. Install Python 3.9+
2. Create and activate a virtual environment:
   ```bash
   cd backend
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Set up PostgreSQL and create a database named `notesexpress`. Update `backend/database/database.py` with your database credentials.
5. Run the FastAPI server:
   ```bash
   uvicorn backend.main:app --reload
   ```

## Setup Frontend

1. Ensure you have Node.js and npm installed.
2. Install dependencies:
   ```bash
   cd frontend
   npm install
   ```
3. Start the Expo development server:
   ```bash
   npm start
   ```

You can run the app on an Android emulator, iOS simulator, or a physical device using the Expo Go app.
