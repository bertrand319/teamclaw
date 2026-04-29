/**
 * Editor type routing utilities.
 * Determines which editor to use based on file extension.
 */

export type EditorType = 'markdown' | 'code';

export const MAX_MARKDOWN_WYSIWYG_CHARS = 512 * 1024;

function isMarkdownExtension(filename: string): boolean {
  const ext = filename.split('.').pop()?.toLowerCase();
  return ext === 'md' || ext === 'markdown';
}

/**
 * Determine which editor type to use for a given filename.
 * HTML files are routed to the code editor (with optional preview via supportsPreview).
 * Skill files (SKILL.md inside skills directories) use code editor for raw editing.
 * Very large Markdown files use CodeMirror because parsing the whole document
 * into a Tiptap/ProseMirror tree can freeze the renderer thread.
 */
export function getEditorType(filename: string, filePath?: string, content?: string): EditorType {
  // Skill markdown files should use CodeMirror for raw frontmatter editing
  if (filePath && isSkillFile(filePath)) return 'code';
  if (isMarkdownExtension(filename)) {
    if (content && content.length > MAX_MARKDOWN_WYSIWYG_CHARS) return 'code';
    return 'markdown';
  }
  return 'code';
}

/**
 * Check if a file path points to a skill file (SKILL.md inside a skills directory).
 */
export function isSkillFile(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/');
  return /\/skills\/[^/]+\/SKILL\.md$/i.test(normalized);
}

/**
 * Get the programming language identifier from a filename for syntax highlighting.
 */
export function getLanguageFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    md: 'markdown',
    css: 'css',
    scss: 'scss',
    less: 'less',
    html: 'html',
    xml: 'xml',
    yaml: 'yaml',
    yml: 'yaml',
    py: 'python',
    rs: 'rust',
    go: 'go',
    java: 'java',
    c: 'c',
    cpp: 'cpp',
    h: 'c',
    hpp: 'cpp',
    sh: 'shell',
    bash: 'shell',
    zsh: 'shell',
    sql: 'sql',
    graphql: 'graphql',
    toml: 'toml',
    ini: 'ini',
    dockerfile: 'dockerfile',
  };
  return languageMap[ext || ''] || 'plaintext';
}

/**
 * Check if file supports preview (HTML or Markdown).
 */
export function supportsPreview(filename: string): 'html' | 'markdown' | null {
  const ext = filename.split('.').pop()?.toLowerCase();
  if (ext === 'html' || ext === 'htm') return 'html';
  if (ext === 'md' || ext === 'markdown') return 'markdown';
  return null;
}
