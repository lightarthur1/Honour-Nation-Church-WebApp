"""One-time: authorise the app to upload to the church's Google Drive.

Needs credentials/oauth-client.json (OAuth client of type "Desktop app").
Run from the backend folder:  python scripts/get_drive_token.py
A browser opens; sign in with the CHURCH Google account and click Allow.
"""
from pathlib import Path

from google_auth_oauthlib.flow import InstalledAppFlow

BASE = Path(__file__).resolve().parents[1]
CLIENT = BASE / "credentials" / "oauth-client.json"
OUT = BASE / "credentials" / "drive-token.json"
SCOPES = ["https://www.googleapis.com/auth/drive.file"]

if not CLIENT.exists():
    raise SystemExit(f"Missing {CLIENT}. Download the OAuth client JSON from Google Cloud and save it there.")

flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT), SCOPES)
creds = flow.run_local_server(port=0, access_type="offline", prompt="consent")
OUT.write_text(creds.to_json())
print(f"Saved {OUT}. Now set DRIVE_ENABLED=true in .env and restart the backend.")
