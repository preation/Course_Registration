import os
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ WARNING: SUPABASE_URL or SUPABASE_SERVICE_KEY is missing from .env")

# Initialize Supabase
supabase: Client = create_client(SUPABASE_URL or "", SUPABASE_KEY or "")

app = FastAPI(title="Course Registration System")

# Fix 1: Add CORS Middleware so frontend fetches aren't blocked by browser policies
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class RegistrationRequest(BaseModel):
    course_id: int

# --- API Endpoints ---

@app.get("/api/courses")
async def get_courses():
    try:
        response = supabase.table("courses").select("*").order("id").execute()
        return response.data
    except Exception as e:
        print(f"Error fetching courses: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/register")
async def register_student(request: RegistrationRequest):
    try:
        dummy_student_id = "00000000-0000-0000-0000-000000000000"
        response = supabase.rpc(
            "register_for_course", 
            {
                "target_course_id": request.course_id, 
                "target_student_id": dummy_student_id
            }
        ).execute()

        if response.data is True:
            return {"status": "success", "message": "Successfully registered!"}
        else:
            raise HTTPException(status_code=400, detail="Course is full or does not exist.")
    except HTTPException:
        raise
    except Exception as e:
        print(f"Error registering: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# --- Serve Frontend Static Files ---
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

@app.get("/")
async def serve_frontend():
    return FileResponse("index.html")