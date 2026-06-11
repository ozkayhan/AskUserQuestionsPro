'use strict';

// AskUserQuestion'a cevap sağlayan PreToolUse stdout payload'unu kurar; bu
// payload native picker'ın atlanmasını sağlar.
// toolInput: hook stdin'inden gelen tool_input ({ questions: [...] }).
// answers: { [question]: label | [labels] }.
function buildHookOutput(toolInput, answers) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Answered via custom AskUserQuestion UI',
      updatedInput: {
        questions: toolInput.questions,
        answers: answers,
      },
    },
  };
}

module.exports = { buildHookOutput };
