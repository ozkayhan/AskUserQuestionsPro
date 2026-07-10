'use strict';

// Tek soru sözleşmesi. MCP ve HTTP bridge aynı doğrulayıcıyı kullanır;
// böylece şema geçerli görünüp backend'de reddedilen payload'lar oluşmaz.

const VALID_TYPES = new Set(['single', 'multi', 'binary', 'scale', 'ranking', 'tree']);

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

function checkTreeNodes(options) {
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
  return null;
}

function validQuestions(questions) {
  if (!Array.isArray(questions) || questions.length === 0) {
    return { ok: false, error: 'questions must be a non-empty array' };
  }

  for (const item of questions) {
    if (!item || typeof item.question !== 'string') {
      return { ok: false, error: 'each question must have a string "question" field' };
    }
    if (item.question.length === 0 || item.question.length > 1000) {
      return { ok: false, error: 'question must be between 1 and 1000 characters' };
    }

    if (item.type !== undefined && !VALID_TYPES.has(item.type)) {
      return {
        ok: false,
        error: `invalid type "${item.type}": must be one of ${Array.from(VALID_TYPES).join(', ')}`,
      };
    }

    const type = item.type || (item.multiSelect ? 'multi' : 'single');
    if (type === 'scale') {
      if (item.options !== undefined) {
        return { ok: false, error: `scale question "${item.question}" must not include options` };
      }
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

    if (Array.isArray(item.options)) {
      const optionError = validateOptions(item.options);
      if (optionError) return { ok: false, error: optionError };
    }
  }

  return { ok: true };
}

module.exports = { VALID_TYPES, validQuestions, validateOptions };
