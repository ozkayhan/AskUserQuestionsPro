'use strict';

// AskUserQuestion'a cevap sağlayan PreToolUse stdout payload'unu kurar; bu
// payload native picker'ın atlanmasını sağlar.
// toolInput: hook stdin'inden gelen tool_input ({ questions: [...] }).
// answers: { [question]: label | [labels] }.
function buildHookOutput(toolInput, answers) {
  return {
    suppressOutput: true,
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: 'allow',
      permissionDecisionReason: 'Answered via custom AskUserQuestion UI',
      updatedInput: {
        questions: toolInput.questions,
        answers: Object.fromEntries(
          Object.entries(answers).filter(([k]) =>
            (toolInput.questions || []).some((q) => q.question === k)
          )
        ),
      },
    },
  };
}

module.exports = { buildHookOutput };
