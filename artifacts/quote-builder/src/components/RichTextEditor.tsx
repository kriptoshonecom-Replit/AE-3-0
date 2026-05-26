import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Color } from "@tiptap/extension-color";
import { TextStyle } from "@tiptap/extension-text-style";
import { useEffect } from "react";

const COLORS = [
  { label: "Black", value: "#000000" },
  { label: "Blue", value: "#1d4ed8" },
  { label: "Green", value: "#15803d" },
  { label: "Red", value: "#b91c1c" },
];

interface RichTextEditorProps {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  minHeight?: number;
}

export function RichTextEditor({ value, onChange, placeholder, minHeight = 110 }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      TextStyle,
      Color,
    ],
    content: value || "",
    onUpdate({ editor }) {
      const html = editor.isEmpty ? "" : editor.getHTML();
      onChange(html);
    },
  });

  useEffect(() => {
    if (!editor) return;
    const current = editor.isEmpty ? "" : editor.getHTML();
    if (current !== value) {
      editor.commands.setContent(value || "", { emitUpdate: false });
    }
  }, [value, editor]);

  if (!editor) return null;

  const activeColor = COLORS.find(
    (c) => editor.isActive("textStyle", { color: c.value })
  )?.value ?? null;

  return (
    <div className="rte-wrapper">
      <div className="rte-toolbar">
        <button
          type="button"
          className={`rte-btn${editor.isActive("bold") ? " rte-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
          title="Bold"
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          className={`rte-btn${editor.isActive("italic") ? " rte-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
          title="Italic"
        >
          <em>I</em>
        </button>
        <div className="rte-divider" />
        <button
          type="button"
          className={`rte-btn${editor.isActive("heading", { level: 1 }) ? " rte-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleHeading({ level: 1 }).run(); }}
          title="Heading"
        >
          H1
        </button>
        <button
          type="button"
          className={`rte-btn${editor.isActive("paragraph") && !editor.isActive("heading") ? " rte-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().setParagraph().run(); }}
          title="Paragraph"
        >
          P
        </button>
        <div className="rte-divider" />
        <button
          type="button"
          className={`rte-btn${editor.isActive("bulletList") ? " rte-btn--active" : ""}`}
          onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
          title="Bullet list"
        >
          &#8226;&#8226;
        </button>
        <div className="rte-divider" />
        <div className="rte-colors">
          {COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              className={`rte-color-btn${activeColor === c.value ? " rte-color-btn--active" : ""}`}
              style={{ background: c.value }}
              onMouseDown={(e) => {
                e.preventDefault();
                if (activeColor === c.value) {
                  editor.chain().focus().unsetColor().run();
                } else {
                  editor.chain().focus().setColor(c.value).run();
                }
              }}
              title={c.label}
            />
          ))}
        </div>
      </div>
      <div className="rte-body" style={{ minHeight }}>
        {editor.isEmpty && !editor.isFocused && placeholder && (
          <div className="rte-placeholder">{placeholder}</div>
        )}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}

export function RichTextDisplay({ html, className }: { html: string; className?: string }) {
  if (!html) return null;
  return (
    <div
      className={`rte-display${className ? ` ${className}` : ""}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}
