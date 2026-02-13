from fastapi import FastAPI, UploadFile, File, HTTPException

from ocr_pipeline import process_pdf_bytes

app = FastAPI()


@app.post("/process")
async def process(file: UploadFile = File(...)):
    if not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF supported")

    pdf_bytes = await file.read()
    try:
        result = process_pdf_bytes(pdf_bytes)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
