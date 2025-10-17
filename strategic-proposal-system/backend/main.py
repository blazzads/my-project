from fastapi import FastAPI

app = FastAPI(title="Strategic Proposal System API")

@app.get("/")
async def root():
    return {"message": "Strategic Proposal System API", "version": "R0.3.1"}

@app.get("/health")
async def health():
    return {"status": "healthy"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)