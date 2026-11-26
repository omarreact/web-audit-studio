"""Unified Vercel entry point; retain the optional analyzer and serve the UI."""
import os
from pathlib import Path
from fastapi import HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from services.analyzer.app import app, ALLOWED_ORIGINS
from services.capture import router

ROOT = Path(__file__).resolve().parent
for hostname in ('web-audit-studio.vercel.app', os.getenv('VERCEL_URL', '')):
    if hostname:
        origin = 'https://' + hostname
        if origin not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(origin)

app.title = 'Web Audit Studio'
app.include_router(router)
app.mount('/assets', StaticFiles(directory=ROOT / 'assets'), name='assets')
app.mount('/vendor', StaticFiles(directory=ROOT / 'vendor'), name='vendor')

@app.get('/', include_in_schema=False)
@app.get('/index.html', include_in_schema=False)
def homepage():
    return FileResponse(ROOT / 'index.html', media_type='text/html', headers={'Cache-Control': 'no-cache'})

@app.get('/single-file.html', include_in_schema=False)
def portable():
    return FileResponse(ROOT / 'single-file.html', media_type='text/html')
