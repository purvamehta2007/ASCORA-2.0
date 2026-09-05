import os
import time
import requests
from dotenv import load_dotenv


# ============================================
# CONFIGURATION
# ============================================

load_dotenv(".env.hardware")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

CLASSROOM_ID = "main-classroom"


if not SUPABASE_URL:
    raise RuntimeError("SUPABASE_URL is missing")

if not SUPABASE_KEY:
    raise RuntimeError("SUPABASE_ANON_KEY is missing")


# ============================================
# SUPABASE RPC
# ============================================

RPC_URL = (
    f"{SUPABASE_URL}/rest/v1/rpc/claim_next_doubt"
)

HEADERS = {
    "apikey": SUPABASE_KEY,
    "Authorization": f"Bearer {SUPABASE_KEY}",
    "Content-Type": "application/json",
}


# ============================================
# CLAIM NEXT STUDENT
# ============================================

def claim_next_student():

    payload = {
        "p_classroom_id": CLASSROOM_ID
    }

    try:

        response = requests.post(
            RPC_URL,
            headers=HEADERS,
            json=payload,
            timeout=10
        )

        if response.status_code != 200:

            print(
                "RPC error:",
                response.status_code
            )

            print(response.text)

            return None

        result = response.json()

        # PostgreSQL function returns null
        # when nobody is waiting.
        if not result:
            return None

        return result

    except requests.RequestException as error:

        print("Network error:", error)

        return None


# ============================================
# MAIN LOOP
# ============================================

print("--------------------------------------------")
print("ASCORA FIFO QUEUE CONTROLLER")
print("--------------------------------------------")
print("Classroom:", CLASSROOM_ID)
print("Waiting for students...")
print()


while True:

    student = claim_next_student()

    if student:

        print()
        print("============================================")
        print("ASCORA SELECTED NEXT STUDENT")
        print("============================================")

        print(
            "Student ID:",
            student.get("student_id")
        )

        print(
            "Request ID:",
            student.get("id")
        )

        print(
            "Raised at:",
            student.get("raised_at")
        )

        print(
            "Status:",
            student.get("status")
        )

        print("============================================")
        print()

        print(
            "🎤 ASCORA should now listen to this student."
        )

        print(
            "For now, this student will remain "
            "in SERVING state."
        )

        print()

        # ----------------------------------------
        # TEMPORARY TEST PAUSE
        #
        # We will replace this with:
        #
        # microphone
        #     ↓
        # speech recognition
        #     ↓
        # AI
        #     ↓
        # answer
        #
        # in Step 7.
        # ----------------------------------------

        time.sleep(10)

        print(
            "Test complete. Leaving student "
            "in serving state."
        )

        print()

    else:

        print(
            "No students waiting...",
            end="\r"
        )

        time.sleep(3)

