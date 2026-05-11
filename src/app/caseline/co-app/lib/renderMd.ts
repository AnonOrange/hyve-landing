// Minimal markdown renderer used by CaseyTab's answer panels.
// Lives in its own file so styled-jsx's parser doesn't have to ingest
// the regex literals alongside JSX templates (it panics on certain
// combinations).

export function renderMd(src: string): string {
  return src
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(^|\n)- (.+)(?=\n|$)/g, '$1<li>$2</li>')
    .replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br />')
    .replace(/^/, '<p>')
    .replace(/$/, '</p>')
}
