"use client";

import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useEffect } from "react";
import type { RichDoc } from "@/shared/rich-text";

/**
 * The one rich-text editor (TipTap 3). StarterKit is cut down to the node and mark types
 * the server accepts (src/shared/rich-text.ts): no links, code, code blocks or underline.
 * Pasted HTML is reduced to these types by the editor's schema, and the server validates
 * again. Content is only ever rendered by ProseMirror, never as an HTML string.
 */
const extensions = [
  StarterKit.configure({
    code: false,
    codeBlock: false,
    link: false,
    underline: false,
    heading: { levels: [1, 2, 3] },
  }),
];

interface Props {
  initial: RichDoc;
  label: string;
  editable?: boolean;
  onChange?: (doc: RichDoc) => void;
  /** Called once the editor exists (focus management, tests). */
  onReady?: (editor: Editor) => void;
  minHeight?: string;
}

export default function RichTextEditor({
  initial,
  label,
  editable = true,
  onChange,
  onReady,
  minHeight,
}: Props) {
  const editor = useEditor({
    extensions,
    content: initial,
    editable,
    immediatelyRender: false,
    shouldRerenderOnTransaction: true,
    editorProps: {
      attributes: {
        "aria-label": label,
        "aria-multiline": "true",
        role: "textbox",
        ...(minHeight ? { style: `min-height: ${minHeight}` } : {}),
      },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON() as RichDoc),
  });

  useEffect(() => {
    if (editor && onReady) onReady(editor);
  }, [editor, onReady]);

  return (
    <div className={editable ? "editor" : "editor read-only"}>
      {editable && editor && <Toolbar editor={editor} />}
      <EditorContent editor={editor} />
    </div>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const chain = () => editor.chain().focus();
  const buttons: { label: string; text: string; active: boolean; run: () => void }[] = [
    {
      label: "Bold",
      text: "B",
      active: editor.isActive("bold"),
      run: () => chain().toggleBold().run(),
    },
    {
      label: "Italic",
      text: "I",
      active: editor.isActive("italic"),
      run: () => chain().toggleItalic().run(),
    },
    {
      label: "Strike",
      text: "S",
      active: editor.isActive("strike"),
      run: () => chain().toggleStrike().run(),
    },
    ...([1, 2, 3] as const).map((level) => ({
      label: `Heading ${level}`,
      text: `H${level}`,
      active: editor.isActive("heading", { level }),
      run: () => chain().toggleHeading({ level }).run(),
    })),
    {
      label: "Bullet list",
      text: "•",
      active: editor.isActive("bulletList"),
      run: () => chain().toggleBulletList().run(),
    },
    {
      label: "Numbered list",
      text: "1.",
      active: editor.isActive("orderedList"),
      run: () => chain().toggleOrderedList().run(),
    },
    {
      label: "Quote",
      text: "❝",
      active: editor.isActive("blockquote"),
      run: () => chain().toggleBlockquote().run(),
    },
    {
      label: "Horizontal rule",
      text: "―",
      active: false,
      run: () => chain().setHorizontalRule().run(),
    },
  ];
  return (
    <div className="editor-toolbar" role="toolbar" aria-label="Formatting">
      {buttons.map((b) => (
        <button
          key={b.label}
          type="button"
          aria-label={b.label}
          title={b.label}
          aria-pressed={b.active}
          onClick={b.run}
        >
          {b.text}
        </button>
      ))}
    </div>
  );
}
