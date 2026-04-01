import test from "node:test";
import assert from "node:assert/strict";
import { transliterateText, transliterateWord, transliterateWordAtCursor } from "../src/shared/transliteration/engine";

test("transliterates common smart words", () => {
  assert.equal(transliterateWord("namaste", "smart").text, "नमस्ते");
  assert.equal(transliterateText("mero naam", "smart"), "मेरो नाम");
});

test("supports explicit halant and slash escape", () => {
  assert.equal(transliterateWord("bas\\", "basic").text, "बस्");
  assert.equal(transliterateText("yo /mobile ramro cha", "smart"), "यो mobile राम्रो छ");
});

test("keeps brace escaped text literal", () => {
  assert.equal(transliterateText("yo {mobile} ramro cha", "smart"), "यो mobile राम्रो छ");
});

test("offers ambiguity candidates", () => {
  const result = transliterateWord("shakti", "smart");
  assert.equal(result.text, "शक्ति");
  assert.ok(result.candidates.length >= 1);
});

test("transliterates the current word at the cursor", () => {
  const result = transliterateWordAtCursor("mero naam ", 9, "smart");
  assert.equal(result.text, "mero नाम ");
  assert.deepEqual(result.range, { start: 5, end: 8 });
});
