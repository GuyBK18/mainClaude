"use client";

import { useEffect, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import { Bold, Heading2, Italic, List, ListOrdered, TextQuote } from "lucide-react";
import { cn } from "@/lib/utils";

function Toolbar({ editor }: { editor: Editor }) {
  const state = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive("bold"),
      italic: e.isActive("italic"),
      heading: e.isActive("heading", { level: 2 }),
      quote: e.isActive("blockquote"),
      bullet: e.isActive("bulletList"),
      ordered: e.isActive("orderedList"),
    }),
  });

  const items = [
    { key: "bold", label: "Bold", icon: Bold, active: state.bold, run: () => editor.chain().focus().toggleBold().run() },
    { key: "italic", label: "Italic", icon: Italic, active: state.italic, run: () => editor.chain().focus().toggleItalic().run() },
    { key: "heading", label: "Section heading", icon: Heading2, active: state.heading, run: () => editor.chain().focus().toggleHeading({ level: 2 }).run() },
    { key: "quote", label: "Quote", icon: TextQuote, active: state.quote, run: () => editor.chain().focus().toggleBlockquote().run() },
    { key: "bullet", label: "Bulleted list", icon: List, active: state.bullet, run: () => editor.chain().focus().toggleBulletList().run() },
    { key: "ordered", label: "Numbered list", icon: ListOrdered, active: state.ordered, run: () => editor.chain().focus().toggleOrderedList().run() },
  ];

  return (
    <div role="toolbar" aria-label="Formatting" className="flex items-center gap-0.5">
      {items.map(({ key, label, icon: Icon, active, run }) => (
        <button
          key={key}
          type="button"
          aria-label={label}
          aria-pressed={active}
          title={label}
          onMouseDown={(e) => e.preventDefault()}
          onClick={run}
          className={cn(
            "pressable grid size-7 place-items-center rounded-sm transition-colors duration-100",
            active ? "bg-ink-6 text-foreground" : "text-muted-foreground hover:bg-ink-3 hover:text-foreground",
          )}
        >
          <Icon className="size-3.5" />
        </button>
      ))}
    </div>
  );
}

/**
 * Serif rich text for summaries and reviews. Saves on a short debounce and on blur;
 * the parent receives HTML. Content is read once per mount, so key it by book.
 */
export function RichTextEditor({
  label,
  initialValue,
  placeholder,
  onSave,
}: {
  label: string;
  initialValue: string;
  placeholder: string;
  onSave: (html: string) => Promise<void> | void;
}) {
  const [status, setStatus] = useState<"idle" | "pending" | "saved">("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const last = useRef(initialValue);
  const saveRef = useRef(onSave);
  useEffect(() => {
    saveRef.current = onSave;
  }, [onSave]);

  const flush = async (html: string) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    // An empty editor still emits <p></p>; store it as empty.
    const value = html === "<p></p>" ? "" : html;
    if (value === last.current) {
      setStatus((s) => (s === "pending" ? "saved" : s));
      return;
    }
    last.current = value;
    await saveRef.current(value);
    setStatus("saved");
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({ heading: { levels: [2] }, codeBlock: false, code: false, horizontalRule: false }),
      Placeholder.configure({ placeholder }),
    ],
    content: initialValue,
    editorProps: { attributes: { "aria-label": label, "aria-multiline": "true", role: "textbox" } },
    onUpdate: ({ editor: e }) => {
      setStatus("pending");
      if (timer.current) clearTimeout(timer.current);
      const html = e.getHTML();
      timer.current = setTimeout(() => void flush(html), 800);
    },
    onBlur: ({ editor: e }) => void flush(e.getHTML()),
  });

  // Save anything still pending when leaving the page.
  useEffect(
    () => () => {
      if (timer.current && editor) void flush(editor.getHTML());
    },
    [editor],
  );

  return (
    <div>
      <div className="mb-4 flex h-7 items-center justify-between gap-4">
        <h3 className="label-meta text-foreground">{label}</h3>
        <div className="flex items-center gap-3">
          <span className="font-display text-[11px] text-muted-foreground" aria-live="polite">
            {status === "pending" ? "Editing…" : status === "saved" ? "Saved" : ""}
          </span>
          {editor && <Toolbar editor={editor} />}
        </div>
      </div>
      <div className="prose-literary border-t border-border pt-5">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
