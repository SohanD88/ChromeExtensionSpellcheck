from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
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
    ignored_words: list[str] = []

@app.get("/health")
def health_check():
    return {"status": "ok"}

@app.post("/spellcheck")
def spellcheck(request: SpellcheckRequest):
    result = find_misspelled_word(request.sentence, request.cursor_position, request.ignored_words)
    return result

