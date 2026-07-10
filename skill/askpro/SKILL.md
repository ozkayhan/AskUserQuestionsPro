---
name: askpro
description: 'Use the mcp__askuserquestionspro__ask tool for structured user questions in Codex App, Codex CLI, or Claude Code. It opens a full-screen local review UI with unlimited questions, grouped headers, and 6 rich types (binary, single, multi, scale, ranking, tree). Trigger when gathering requirements, preferences, surveys, onboarding data, or whenever choices and review improve the answer. Critical payload rule: every options entry must be an object with a string label, never a bare string; use the host-native tool only when askpro is unavailable or a short free-text question is clearer.'
---

# askpro — structured questions for Codex and Claude Code

## Critical payload invariant

Before calling the tool, validate the payload yourself. Every `options` entry
must be an object with a non-empty string `label`:

```json
{ "options": [{ "label": "İlkbahar" }, { "label": "Yaz" }] }
```

Never send this shape:

```json
{ "options": ["İlkbahar", "Yaz"] }
```

The server rejects bare string options. Fix the payload before calling again;
do not inspect the bridge, port, browser process, or MCP logs for this input
error. This invariant applies recursively to every tree `children` entry too.

Use this preflight checklist:

1. `question` is a non-empty string.
2. `header` is present and identifies the group.
3. `single`, `multi`, `ranking`, and `tree` use option objects; `ranking` has at least two.
4. `binary` omits `options` or supplies exactly two option objects.
5. `scale` supplies `min`, `max`, and positive `step`; generic clients may include `options`, which the scale UI ignores.
6. Tree `children` values are arrays of the same option-object shape.

## When to use this tool

Use `mcp__askuserquestionspro__ask` when:

- You have **any number** of questions (it handles 1 to unlimited)
- Answers benefit from **structured choices** instead of free text
- You want **grouped questions** under logical section headers
- You need richer types: scales, rankings, or tree selection

Host-native tools remain the safe fallback: Codex exposes `request_user_input`
(one to three short structured questions in supported modes), while Claude Code
exposes `AskUserQuestion` (up to four questions). Prefer askpro when its larger,
reviewable UI or richer types materially help. If the MCP call fails, inspect
the returned category once:

- `Invalid question input` → correct the payload (especially `{ "label": ... }`) and retry once.
- `bridge unavailable`, registration timeout, or user cancellation → use the native tool that exists in the current host.
- Never describe an input-validation error as a bridge outage or run local diagnostics for it.

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

`question` and `header` are **required** on every item. If `type` is omitted,
`multiSelect: true` selects `multi`; otherwise the type defaults to `single`.

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
  "options": [{ "label": "Performans" }, { "label": "Güvenlik" }, { "label": "Kullanım kolaylığı" }]
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
  "options": [{ "label": "Hız" }, { "label": "Maliyet" }, { "label": "Güvenilirlik" }]
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
      "children": [{ "label": "React" }, { "label": "Vue" }, { "label": "Angular" }]
    },
    {
      "label": "Backend",
      "children": [
        {
          "label": "Node.js",
          "children": [{ "label": "Express" }, { "label": "Fastify" }]
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

| Type    | Value                                              |
| ------- | -------------------------------------------------- |
| binary  | `"Evet"` or `"Hayır"` (or your custom label)       |
| single  | `"Label"` (or user's typed text if Other selected) |
| multi   | `["Label A", "Label B"]`                           |
| scale   | `7`                                                |
| ranking | `["First", "Second", "Third"]`                     |
| tree    | `["Root", "Child", "Leaf"]`                        |

**Skipped questions are absent from the map.** Always check before using:

```js
const db = answers['Hangi veritabanını kullanıyorsunuz?'];
if (db) {
  /* use it */
}
```

An all-skipped session returns `{ answers: {} }`.

---

## Best practices

**Batch related questions into one call.** The UI presents one focused question
at a time with sidebar navigation and a final review screen. Put related
questions in one `questions` array so the user can move between them and submit
once.

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
          "children": [{ "label": "AWS" }, { "label": "GCP" }, { "label": "Azure" }]
        },
        {
          "label": "On-premise",
          "children": [{ "label": "Kubernetes" }, { "label": "Bare metal" }]
        }
      ]
    }
  ]
}
```

**Reading the result:**

```js
const { answers } = result;

const isNew = answers['Bu proje yeni bir başlangıç mı?']; // "Evet" | "Hayır" | undefined
const lang = answers['Projenin birincil dili nedir?']; // "TypeScript" | ...
const integrations = answers['Hangi entegrasyonlar gerekli?']; // ["OAuth / SSO", ...]
const perfScore = answers['Performans ne kadar kritik?']; // 1-10
const priority = answers['Bu özellikleri öncelik sırasına koy']; // ["Hız", "Güvenlik", ...]
const deployment = answers['Hedef deployment ortamı nedir?']; // ["Cloud", "AWS"]
```

---

## Validation rules (avoid 400 errors)

| Type    | Required                                                  | Forbidden                       |
| ------- | --------------------------------------------------------- | ------------------------------- |
| binary  | —                                                         | options length != 2 if provided |
| single  | options non-empty                                         | —                               |
| multi   | options non-empty                                         | —                               |
| scale   | min, max, step; min < max; step > 0                       | —                               |
| ranking | options length >= 2                                       | —                               |
| tree    | options non-empty; children arrays if present; depth <= 6 | —                               |

The server returns HTTP 400 with `{ error: "..." }` on validation failure — fix the shape and retry.
