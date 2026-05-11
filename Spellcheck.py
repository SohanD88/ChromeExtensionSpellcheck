import re
import sys
from spellchecker import SpellChecker as SC
spell = SC()

def get_word_and_position(sentence):
    words = []
    for match in re.finditer(r"[A-Za-z]+", sentence):
        words.append({"word": match.group(), "start": match.start(), "end": match.end()})
    return words

def find_misspelled_word(sentence, cursor_position):
    cursor_position = max(0, min(cursor_position, len(sentence)))
    words = get_word_and_position(sentence)
    words_before_cursor = [w for w in words if w["start"] <= cursor_position]

    for item in reversed(words_before_cursor):
        og_word = item["word"]
        checked_word = og_word.lower()
        if checked_word in spell.unknown([checked_word]):
            correction = spell.correction(checked_word)
            return {"word": og_word, "correction": correction, "start": item["start"], "end": item["end"], "cursor_position": cursor_position}
        
    return {"word": None, "correction": None, "start": None, "end": None, "cursor_position": cursor_position}

if __name__ == "__main__":
    if len(sys.argv) == 3:
        sentence = sys.argv[1]
        cursor_position = int(sys.argv[2])
    else:
        sentence = input("Enter a sentence: ")
        cursor_position = len(sentence)

    result = find_misspelled_word(sentence, cursor_position)
    print(result)