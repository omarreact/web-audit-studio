"""Run the full capture UI on a dedicated local machine, never on Vercel."""
import os

def main():
    if os.getenv('VERCEL'):
        raise SystemExit('Full local capture must not run in a public serverless deployment.')
    os.environ['WEB_AUDIT_LOCAL_FULL']='1'
    import uvicorn
    uvicorn.run('app:app',host='127.0.0.1',port=8789,workers=1)

if __name__=='__main__':
    main()
