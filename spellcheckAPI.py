from fastapi import FastAPI, HTTPException
import requests
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from spellcheck import find_misspelled_word 


app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
    allow_credentials=False,
)

class SpellcheckRequest(BaseModel):
    sentence: str
    cursor_position: int
    ignored_words: list[str] = Field(default_factory=list)

@app.get("/health")
def health_check():
    return {"status": "ok", "languagetool": "ok"}

@app.post("/spellcheck")
def spellcheck(request: SpellcheckRequest):
    try:
        return find_misspelled_word(
            request.sentence,
            request.cursor_position,
            request.ignored_words,
        )
    except requests.RequestException:
        raise HTTPException(status_code=503, detail="LanguageTool is unavailable")
