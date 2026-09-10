import os
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv
from supabase import create_client, Client

# Load environment variables
load_dotenv()

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

if not SUPABASE_URL or not SUPABASE_KEY:
    raise ValueError("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in .env file.")

supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

app = FastAPI(title="Preation Eduversity Portal")

# Configure CORS for frontend communication
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Data Models ---
class SignUpRequest(BaseModel):
    email: str
    password: str
    name: str
    age: int
    qualification: str

class LoginRequest(BaseModel):
    email: str
    password: str

class RegistrationRequest(BaseModel):
    course_id: int

class TokenVerifyRequest(BaseModel):
    access_token: str

# --- Authentication Dependency ---
async def get_current_user(authorization: str = Header(None)):
    """Extracts and verifies the JWT token from the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication token required. Please log in.")
    
    token = authorization.split(" ")[1]
    try:
        user_response = supabase.auth.get_user(token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        return user_response.user
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Authentication failed: {str(e)}")

# --- Auth Endpoints ---
@app.post("/api/signup")
async def signup(data: SignUpRequest):
    try:
        # Create user in Supabase Auth
        auth_res = supabase.auth.sign_up({"email": data.email, "password": data.password})
        
        if not auth_res.user:
            raise HTTPException(status_code=400, detail="User registration failed.")
            
        # SECURITY CHECK: If identities is empty, it means the email already exists!
        if not auth_res.user.identities:
            raise HTTPException(status_code=400, detail="An account with this email already exists.")
            
        user_id = auth_res.user.id
        
        # Save additional student profile metadata
        supabase.table("profiles").insert({
            "id": user_id,
            "name": data.name,
            "age": data.age,
            "qualification": data.qualification
        }).execute()

        return {"status": "success", "message": "Account created successfully! You can now log in."}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))

@app.post("/api/login")
async def login(data: LoginRequest):
    try:
        # 1. Authenticate with Supabase Auth
        auth_res = supabase.auth.sign_in_with_password({
            "email": data.email,
            "password": data.password
        })
        
        if not auth_res.session:
            raise HTTPException(status_code=401, detail="Invalid email or password.")
            
        user_id = auth_res.user.id
        
        # 2. Fetch Profile Safely (Defensive Programming to prevent crashes on orphaned users)
        profile_res = supabase.table("profiles").select("name").eq("id", user_id).execute()
        
        student_name = "Student" 
        if profile_res.data and len(profile_res.data) > 0:
            student_name = profile_res.data[0].get("name", "Student")
            
        return {
            "access_token": auth_res.session.access_token,
            "name": student_name
        }
        
    except Exception as e:
        error_msg = str(e)
        if "AuthApiError" in error_msg or "invalid credentials" in error_msg.lower():
            raise HTTPException(status_code=401, detail="Invalid email or password.")
        raise HTTPException(status_code=500, detail=f"Backend Error: {error_msg}")

@app.post("/api/verify-token")
async def verify_token(data: TokenVerifyRequest):
    """Verifies tokens redirected from Supabase OAuth or Email confirmation links."""
    try:
        user_response = supabase.auth.get_user(data.access_token)
        if not user_response or not user_response.user:
            raise HTTPException(status_code=401, detail="Invalid session token.")
        
        user_id = user_response.user.id
        
        # Safely extract profile data (crucial for OAuth users)
        profile = supabase.table("profiles").select("name").eq("id", user_id).execute()
        student_name = "Student"
        if profile.data and len(profile.data) > 0:
            student_name = profile.data[0].get("name", "Student")

        return {
            "status": "success",
            "access_token": data.access_token,
            "user_id": user_id,
            "name": student_name,
            "email": user_response.user.email
        }
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Token verification failed: {str(e)}")

# --- Course & Registration Endpoints ---
@app.get("/api/courses")
async def get_courses():
    try:
        response = supabase.table("courses").select("*").order("id").execute()
        return response.data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/register")
async def register_student(request: RegistrationRequest, current_user = Depends(get_current_user)):
    """Securely registers the authenticated student using their real UUID."""
    try:
        response = supabase.rpc(
            "register_for_course", 
            {
                "target_course_id": request.course_id, 
                "target_student_id": current_user.id
            }
        ).execute()

        if response.data is True:
            return {"status": "success", "message": f"Successfully registered student ID: {current_user.id}"}
        else:
            raise HTTPException(status_code=400, detail="Course is full or unavailable.")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/my-enrollments")
async def get_my_enrollments(current_user = Depends(get_current_user)):
    """Placeholder to prevent 404 crashes on Render when clicking 'My Dashboard'."""
    try:
        # Returns empty list for now. Complex SQL Join logic goes here later.
        return []
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# --- Serve Static Assets ---
app.mount("/css", StaticFiles(directory="css"), name="css")
app.mount("/js", StaticFiles(directory="js"), name="js")

# Catch-all route to serve the SPA index.html
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    # Ensure backend API 404s do not accidentally serve the HTML page
    if full_path.startswith("api/"):
        raise HTTPException(status_code=404, detail="API endpoint not found")
    return FileResponse("index.html")