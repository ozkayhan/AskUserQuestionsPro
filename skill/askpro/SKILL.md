---
name: askpro
description: "Reference guide for using the mcp__askuserquestionspro__ask tool — a full-screen web UI replacement for the built-in AskUserQuestion that supports unlimited questions, 6 rich question types (binary, single, multi, scale, ranking, tree), and grouped headers. Use this skill whenever you are about to ask the user anything — gathering requirements, collecting preferences, running surveys, onboarding flows, or any situation with more than 4 questions. Always prefer mcp__askuserquestionspro__ask over the built-in AskUserQuestion — it gives users a far better experience and removes the 4-question cap entirely. Even for 1-3 questions, use it when the answer benefits from structured choices rather than free text."
---

# askpro — mcp__askuserquestionspro__ask reference

## When to use this tool (not the built-in AskUserQuestion)

Use `mcp__askuserquestionspro__ask` when:
- You have **any number** of questions (it handles 1 to unlimited)
- Answers benefit from **structured choices** instead of free text
- You want **grouped questions** under logical section headers
- You need richer types: scales, rankings, or tree selection

The built-in `AskUserQuestion` is plain text only and hard-capped at 4 questions. This tool replaces it entirely.

## Tool call shape

```json
{
  "questions": [
    {
      "question": "Unique question text — also the key in the answer map",
      "header": "Section label shown above this group",
      "type": "binary|single|multi|scale|ranking|tree",
      ...type-specific fields
    }
  ]
}
```

`question` and `header` are **required** on every item. `type` defaults based on whether `options` is present.

---

## Question types

### binary — yes/no choice
```json
{
  "question": "Mevcut projeye devam edelim mi?",
  "header": "Karar",
  "type": "binary"
}
```
- `options` is optional; omit for default Evet/Hayır buttons
- If you provide `options`, exactly 2 items required
- No "Other" field appended

### single — pick exactly one
```json
{
  "question": "Hangi veritabanını kullanıyorsunuz?",
  "header": "Teknik Detaylar",
  "type": "single",
  "options": [
    { "label": "PostgreSQL" },
    { "label": "MySQL", "description": "MariaDB dahil" },
    { "label": "MongoDB" }
  ]
}
```
- `options` required, non-empty
- UI automatically appends an "Other" option where the user can type freely

### multi — pick any number
```json
{
  "question": "Hangi özellikler öncelikli?",
  "header": "Öncelikler",
  "type": "multi",
  "options": [
    { "label": "Performans" },
    { "label": "Güvenlik" },
    { "label": "Kullanım kolaylığı" }
  ]
}
```
- `options` required
- UI automatically appends "Other"
- Returns `string[]`

### scale — numeric slider
```json
{
  "question": "Bu özelliği ne kadar önemli buluyorsunuz?",
  "header": "Öncelik",
  "type": "scale",
  "min": 1,
  "max": 10,
  "step": 1,
  "leftLabel": "Düşük",
  "rightLabel": "Yüksek"
}
```
- `min`, `max`, `step` all required; `leftLabel`/`rightLabel` optional
- Do NOT include `options`
- Returns a number

### ranking — drag to order
```json
{
  "question": "Bu özellikleri önem sırasına göre sırala",
  "header": "Öncelikler",
  "type": "ranking",
  "options": [
    { "label": "Hız" },
    { "label": "Maliyet" },
    { "label": "Güvenilirlik" }
  ]
}
```
- `options` required, minimum 2 items
- No "Other" appended
- Returns `string[]` in user-chosen order (index 0 = most important)

### tree — hierarchical path selection
```json
{
  "question": "Hangi framework'ü kullanıyorsunuz?",
  "header": "Teknik Stack",
  "type": "tree",
  "options": [
    {
      "label": "Frontend",
      "children": [
        { "label": "React" },
        { "label": "Vue" },
        { "label": "Angular" }
      ]
    },
    {
      "label": "Backend",
      "children": [
        {
          "label": "Node.js",
          "children": [
            { "label": "Express" },
            { "label": "Fastify" }
          ]
        },
        { "label": "Python / FastAPI" }
      ]
    }
  ]
}
```
- `options` required, non-empty; leaf nodes (no `children`) are the final selectable answers
- Maximum depth: 6 levels
- No "Other" appended
- Returns `string[]` path from root to leaf: `["Backend", "Node.js", "Express"]`

---

## Answer shape

The tool returns `{ answers: { "<question text>": <value> } }`.

| Type | Value |
|------|-------|
| binary | `"Evet"` or `"Hayır"` (or your custom label) |
| single | `"Label"` (or user's typed text if Other selected) |
| multi | `["Label A", "Label B"]` |
| scale | `7` |
| ranking | `["First", "Second", "Third"]` |
| tree | `["Root", "Child", "Leaf"]` |

**Skipped questions are absent from the map.** Always check before using:
```js
const db = answers["Hangi veritabanını kullanıyorsunuz?"]
if (db) { /* use it */ }
```

An all-skipped session returns `{ answers: {} }`.

---

## Best practices

**Batch everything into one call.** The UI renders all questions simultaneously — there's no reason to call the tool multiple times in sequence. Put all your questions in the single `questions` array.

**Headers group related questions.** Questions with the same `header` value appear under the same section label. Use headers to give users context:

```json
[
  { "header": "Proje Genel Bilgisi", "question": "...", "type": "single", ... },
  { "header": "Proje Genel Bilgisi", "question": "...", "type": "binary" },
  { "header": "Teknik Tercihler",    "question": "...", "type": "tree",   ... }
]
```

**Match type to intent:**
- Decision → `binary`
- One correct answer from a list → `single`
- "Select all that apply" → `multi`
- Satisfaction / confidence / priority score → `scale`
- Relative importance of items → `ranking`
- Category → subcategory → leaf → `tree`

---

## Complete example — all types in one call

```json
{
  "questions": [
    {
      "question": "Bu proje yeni bir başlangıç mı?",
      "header": "Proje Durumu",
      "type": "binary"
    },
    {
      "question": "Projenin birincil dili nedir?",
      "header": "Proje Durumu",
      "type": "single",
      "options": [
        { "label": "TypeScript" },
        { "label": "Python" },
        { "label": "Go" },
        { "label": "Rust" }
      ]
    },
    {
      "question": "Hangi entegrasyonlar gerekli?",
      "header": "Gereksinimler",
      "type": "multi",
      "options": [
        { "label": "OAuth / SSO" },
        { "label": "Webhook desteği" },
        { "label": "E-posta bildirimleri" },
        { "label": "Dosya depolama" }
      ]
    },
    {
      "question": "Performans ne kadar kritik?",
      "header": "Gereksinimler",
      "type": "scale",
      "min": 1,
      "max": 10,
      "step": 1,
      "leftLabel": "Önemli değil",
      "rightLabel": "Kritik"
    },
    {
      "question": "Bu özellikleri öncelik sırasına koy",
      "header": "Öncelikler",
      "type": "ranking",
      "options": [
        { "label": "Hız" },
        { "label": "Güvenlik" },
        { "label": "Maliyet" },
        { "label": "Kullanım kolaylığı" }
      ]
    },
    {
      "question": "Hedef deployment ortamı nedir?",
      "header": "Altyapı",
      "type": "tree",
      "options": [
        {
          "label": "Cloud",
          "children": [
            { "label": "AWS" },
            { "label": "GCP" },
            { "label": "Azure" }
          ]
        },
        {
          "label": "On-premise",
          "children": [
            { "label": "Kubernetes" },
            { "label": "Bare metal" }
          ]
        }
      ]
    }
  ]
}
```

**Reading the result:**
```js
const { answers } = result

const isNew        = answers["Bu proje yeni bir başlangıç mı?"]   // "Evet" | "Hayır" | undefined
const lang         = answers["Projenin birincil dili nedir?"]       // "TypeScript" | ...
const integrations = answers["Hangi entegrasyonlar gerekli?"]       // ["OAuth / SSO", ...]
const perfScore    = answers["Performans ne kadar kritik?"]          // 1-10
const priority     = answers["Bu özellikleri öncelik sırasına koy"] // ["Hız", "Güvenlik", ...]
const deployment   = answers["Hedef deployment ortamı nedir?"]      // ["Cloud", "AWS"]
```

---

## Validation rules (avoid 400 errors)

| Type | Required | Forbidden |
|------|----------|-----------|
| binary | — | options length != 2 if provided |
| single | options non-empty | — |
| multi | options non-empty | — |
| scale | min, max, step; min < max; step > 0 | options field |
| ranking | options length >= 2 | — |
| tree | options non-empty; children arrays if present; depth <= 6 | — |

The server returns HTTP 400 with `{ error: "..." }` on validation failure — fix the shape and retry.
