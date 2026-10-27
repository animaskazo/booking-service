import { useEffect, useRef } from 'react';
import { Bold, Italic, List, ListOrdered, Underline } from 'lucide-react';

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}

export default function RichTextEditor({ value, onChange, placeholder }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML !== value) {
      editorRef.current.innerHTML = value || '';
    }
  }, [value]);

  const exec = (command: string, valueArg?: string) => {
    document.execCommand('styleWithCSS', false, 'true');
    document.execCommand(command, false, valueArg);
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  const handleInput = () => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden bg-white">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-100 bg-slate-50/60 p-1.5">
        <button type="button" onClick={() => exec('bold')} className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900" title="Negrita">
          <Bold className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec('italic')} className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900" title="Cursiva">
          <Italic className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec('underline')} className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900" title="Subrayado">
          <Underline className="h-4 w-4" />
        </button>
        <div className="mx-1 h-5 w-px bg-slate-200" />
        <button type="button" onClick={() => exec('insertUnorderedList')} className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900" title="Lista">
          <List className="h-4 w-4" />
        </button>
        <button type="button" onClick={() => exec('insertOrderedList')} className="rounded-lg p-1.5 text-slate-600 hover:bg-white hover:text-slate-900" title="Lista numerada">
          <ListOrdered className="h-4 w-4" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onInput={handleInput}
        className="min-h-[200px] max-h-[420px] overflow-y-auto px-4 py-3 text-sm leading-6 text-slate-700 focus:outline-none prose prose-sm max-w-none"
        data-placeholder={placeholder}
      />
    </div>
  );
}
