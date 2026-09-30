import Editor, { type BeforeMount } from '@monaco-editor/react';

const definePine: BeforeMount = (monaco) => {
  monaco.editor.defineTheme('pine', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#121715',
      'editor.lineHighlightBackground': '#1a211e',
      'editorLineNumber.foreground': '#95a39d',
    },
  });
};

export default function CodeEditor({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <Editor
      height="420px"
      path="solution.ts"
      defaultLanguage="typescript"
      theme="pine"
      value={value}
      beforeMount={definePine}
      onChange={(next) => onChange(next ?? '')}
      options={{
        minimap: { enabled: false },
        fontSize: 13,
        fontFamily: '"IBM Plex Mono", ui-monospace, monospace',
        scrollBeyondLastLine: false,
        tabSize: 2,
        automaticLayout: true,
      }}
    />
  );
}
