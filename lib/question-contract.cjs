'use strict';

// Tek soru sözleşmesi. MCP şeması, HTTP bridge ve host adapter'ları aynı
// doğrulayıcıyı kullanır; böylece şema geçerli görünüp backend'de reddedilen
// payload'lar veya farklı header davranışları oluşmaz.

const VALID_TYPES = new Set(['single', 'multi', 'binary', 'scale', 'ranking', 'tree']);
const GENERAL_HEADER = 'General';

function validLabel(label) {
  return typeof label === 'string' && label.length >= 1 && label.length <= 500;
}

function treeDepth(options, depth = 1) {
  if (!Array.isArray(options) || options.length === 0) return depth;
  let max = depth;
  for (const opt of options) {
    if (Array.isArray(opt?.children) && opt.children.length > 0) {
      max = Math.max(max, treeDepth(opt.children, depth + 1));
    }
  }
  return max;
}

function duplicateLabelError(options, prefix) {
  const seen = new Set();
  for (const opt of options) {
    if (!opt || typeof opt !== 'object' || Array.isArray(opt)) continue;
    if (seen.has(opt.label)) return `${prefix} has duplicate option label "${opt.label}"`;
    seen.add(opt.label);
  }
  return null;
}

function checkTreeNodes(options) {
  const duplicate = duplicateLabelError(options, 'tree options at the same level');
  if (duplicate) return duplicate;
  for (const opt of options) {
    if (!opt || !validLabel(opt.label)) {
      return 'each tree option must be an object with a non-empty string "label" (max 500 characters)';
    }
    if (opt.children !== undefined && !Array.isArray(opt.children)) {
      return `tree option "${opt.label}" has invalid children (must be array)`;
    }
    if (Array.isArray(opt.children) && opt.children.length > 0) {
      const error = checkTreeNodes(opt.children);
      if (error) return error;
    }
  }
  return null;
}

function validateOptions(options, prefix = 'each option') {
  if (!Array.isArray(options)) return `${prefix} must be an array of {label:string} objects`;
  for (const opt of options) {
    if (!opt || typeof opt !== 'object' || Array.isArray(opt) || !validLabel(opt.label)) {
      return `${prefix} must be an object with a non-empty string "label" (max 500 characters); strings like "Option" are invalid`;
    }
  }
  return duplicateLabelError(options, prefix);
}

function cloneQuestions(questions) {
  return questions.map((item) => ({
    ...item,
    header: item.header === undefined ? GENERAL_HEADER : item.header,
    options: Array.isArray(item.options)
      ? item.options.map((option) => ({
          ...option,
          ...(Array.isArray(option.children)
            ? { children: option.children.map((child) => ({ ...child })) }
            : {}),
        }))
      : item.options,
  }));
}

function validQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: 'questions must be a non-empty array' };
  }

  const seenQuestions = new Set();
  for (const item of questions) {
    if (!item || typeof item.question !== 'string') {
      return { ok: false, error: 'each question must have a string "question" field' };
    }
    if (item.question.length === 0 || item.question.length > 1000) {
      return { ok: false, error: 'question must be between 1 and 1000 characters' };
    }
    if (seenQuestions.has(item.question)) {
      return { ok: false, error: `duplicate question text "${item.question}" is not allowed` };
    }
    seenQuestions.add(item.question);

    if (item.header !== undefined && !validLabel(item.header)) {
      return {
        ok: false,
        error: `question "${item.question}" header must be a non-empty string (max 500 characters)`,
      };
    }

    if (item.type !== undefined && !VALID_TYPES.has(item.type)) {
      return {
        ok: false,
        error: `invalid type "${item.type}": must be one of ${Array.from(VALID_TYPES).join(', ')}`,
      };
    }

    const type = item.type || (item.multiSelect ? 'multi' : 'single');
    if (type === 'scale') {
      if (typeof item.min !== 'number' || typeof item.max !== 'number') {
        return {
          ok: false,
          error: `scale question "${item.question}" requires numeric min and max`,
        };
      }
      if (item.min >= item.max) {
        return { ok: false, error: `scale question "${item.question}" min must be less than max` };
      }
      if (item.step !== undefined && (typeof item.step !== 'number' || item.step <= 0)) {
        return {
          ok: false,
          error: `scale question "${item.question}" step must be a positive number`,
        };
      }
    } else if (type === 'ranking') {
      if (!Array.isArray(item.options) || item.options.length < 2) {
        return {
          ok: false,
          error: `ranking question "${item.question}" requires at least 2 options`,
        };
      }
    } else if (type === 'binary') {
      if (
        item.options !== undefined &&
        (!Array.isArray(item.options) || item.options.length !== 2)
      ) {
        return {
          ok: false,
          error: `binary question "${item.question}" must have exactly 2 options when options is provided`,
        };
      }
    } else if (type === 'tree') {
      if (!Array.isArray(item.options) || item.options.length === 0) {
        return {
          ok: false,
          error: `tree question "${item.question}" requires a non-empty options array`,
        };
      }
      if (treeDepth(item.options) > 6) {
        return { ok: false, error: `tree question "${item.question}" exceeds maximum depth of 6` };
      }
      const treeError = checkTreeNodes(item.options);
      if (treeError) return { ok: false, error: treeError };
    } else if (!Array.isArray(item.options) || item.options.length === 0) {
      return { ok: false, error: `question "${item.question}" requires a non-empty options array` };
    }

    if (item.options !== undefined && type !== 'tree') {
      const optionError = validateOptions(item.options, `options for question "${item.question}"`);
      if (optionError) return { ok: false, error: optionError };
    }
  }

  const result = { ok: true };
  // Keep the historical `{ok:true}` enumerable shape for callers that compare
  // the result directly, while exposing normalized questions to boundary code.
  Object.defineProperty(result, 'questions', {
    value: cloneQuestions(questions),
    enumerable: false,
  });
  return result;
}

const OPTION_SCHEMA = {
  type: 'object',
  required: ['label'],
  properties: {
    label: { type: 'string', minLength: 1, maxLength: 500 },
    description: { type: 'string' },
    children: {
      type: 'array',
      items: { $ref: '#/$defs/option' },
      description: 'Nested options for tree questions.',
    },
  },
};

const QUESTION_SCHEMA = {
  type: 'object',
  required: ['questions'],
  properties: {
    questions: {
      type: 'array',
      minItems: 1,
      items: {
        type: 'object',
        required: ['question'],
        properties: {
          question: { type: 'string', minLength: 1, maxLength: 1000 },
          header: { type: 'string', minLength: 1, maxLength: 500, default: GENERAL_HEADER },
          type: { type: 'string', enum: Array.from(VALID_TYPES) },
          multiSelect: { type: 'boolean' },
          min: { type: 'number' },
          max: { type: 'number' },
          step: { type: 'number' },
          leftLabel: { type: 'string' },
          rightLabel: { type: 'string' },
          options: { type: 'array', minItems: 1, items: OPTION_SCHEMA },
        },
      },
    },
  },
  $defs: { option: OPTION_SCHEMA },
};

module.exports = {
  VALID_TYPES,
  GENERAL_HEADER,
  QUESTION_SCHEMA,
  validQuestions,
  validateOptions,
};
