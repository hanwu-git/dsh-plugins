/**
 * dsh-memory-nodes — compile (二次编译) and injection text builders.
 *
 * The compiler asks the LLM to re-distil accumulated raw records into a fixed
 * five-section Markdown structure (design v1.0 §4.3/§7). Pure string logic only;
 * the actual LLM call lives in the entry module (ctx.llm.stream).
 */
import { maskSecrets } from './store.js';

export const SECTIONS = ['概览', '关键事实', '偏好与约定', '进行中事项', '历史坑'];

const KIND_LABEL = { observe: '观察', decision: '决策', preference: '偏好', fact: '事实', pitfall: '坑' };

function renderRawLines(records) {
  return records
    .map(r => `${r.seq}. [${r.ts.slice(0, 16).replace('T', ' ')}][${KIND_LABEL[r.kind] ?? r.kind}] ${maskSecrets(r.text)}`)
    .join('\n');
}

/** Build the compiler user prompt: instructions + prior compiled + new raw records. */
export function buildCompilePrompt({ nodeLabel, priorCompiled, records, budgetBytes }) {
  const prior = priorCompiled?.trim()
    ? `【现有编译层（请在其基础上合并、去重、更新，不要丢失仍然有效的条目）】\n${priorCompiled.trim()}\n`
    : '【现有编译层】（暂无）\n';
  const prompt = [
    `你是「${nodeLabel}」长期记忆节点的编译器。下面是该节点的现有编译层与新增原始记录。`,
    '请输出新的编译层 Markdown，要求：',
    '1. 结构固定为且仅为以下五个二级标题，顺序不变：' + SECTIONS.map(s => `## ${s}`).join('、') + '；',
    '2. 合并重复与过时条目：同一事实以最新记录为准；已被新记录推翻的内容移入「历史坑」或删除；',
    '3. 保留具体、可复用的信息（数字、结论、路径、约定）；丢弃寒暄与一次性过程细节；',
    `4. 全文不超过 ${budgetBytes} 字节（约 ${Math.floor(budgetBytes / 3)} 个汉字），超出时优先压缩「关键事实」以外的部分；`,
    '5. 不得包含任何密钥、令牌、凭据样式字符串；发现即以 [REDACTED] 代替；',
    '6. 只输出 Markdown 正文，不要解释、不要代码围栏。',
    '',
    prior,
    `【新增原始记录（共 ${records.length} 条，已按时间排序）】`,
    renderRawLines(records),
  ].join('\n');
  return prompt;
}

/** Lightweight structural check + secret rescan of the compiler output. */
export function validateCompiled(markdown) {
  const text = String(markdown ?? '');
  const missing = SECTIONS.filter(s => !text.includes(`## ${s}`));
  if (missing.length > 0) return { ok: false, reason: `缺少小节: ${missing.join('、')}` };
  if (/(sk-|ghp_|github_pat_|AKIA|xox[baprs]-)[A-Za-z0-9_-]{10,}/.test(text)) {
    return { ok: false, reason: '输出疑似包含凭据样式字符串' };
  }
  return { ok: true };
}

/** Defensive post-processing applied even to a valid output. */
export function sanitizeCompiled(markdown) {
  return maskSecrets(String(markdown ?? '').trim());
}

/* ---------- injection text (design §5) ---------- */

const USAGE_HEADER = [
  '<memory-nodes>',
  '以下是你的长期记忆（编译层）。与当前任务相关时直接使用；',
  '用户要求记住、或出现值得跨会话留存的事实时，调用 memory_write 沉淀（不要写入凭据）；',
  '需要查看完整记忆时调用 memory_read。',
].join('\n');

function truncateByBytes(text, budgetBytes) {
  if (Buffer.byteLength(text, 'utf8') <= budgetBytes) return text;
  // Reserve room for the truncation marker; walk code points to avoid splitting one.
  const limit = Math.max(0, budgetBytes - Buffer.byteLength('\n…[已截断]', 'utf8'));
  const chars = [...text];
  let bytes = 0;
  let out = '';
  for (const ch of chars) {
    const size = Buffer.byteLength(ch, 'utf8');
    if (bytes + size > limit) break;
    bytes += size;
    out += ch;
  }
  return out + '\n…[已截断]';
}

/**
 * Build the injected context text for one node: usage header + compiled body,
 * truncated to the per-node budget (default 8 KB).
 */
export function buildInjectText(compiled, budgetBytes = 8192) {
  const header = USAGE_HEADER;
  const tail = '\n</memory-nodes>';
  if (!compiled || !compiled.trim()) return `${header}\n（该节点暂无编译内容）${tail}`;
  // The whole message must fit the budget: header + tail are part of it.
  const bodyBudget = budgetBytes
    - Buffer.byteLength(header, 'utf8')
    - Buffer.byteLength(tail, 'utf8') - 2;
  const body = truncateByBytes(compiled.trim(), Math.max(512, bodyBudget));
  return `${header}\n${body}${tail}`;
}
