declare module "@arborium/lean" {
  export type LeanTreeSitterSpan = {
    start: number;
    end: number;
    capture: string;
    pattern_index?: number;
  };

  export type LeanTreeSitterParseResult = {
    spans?: LeanTreeSitterSpan[];
    injections?: unknown[];
  };

  export default function init(moduleOrPath?: { module_or_path?: string | URL | Request | Response | BufferSource } | string | URL | Request | Response | BufferSource): Promise<unknown>;
  export function create_session(): number;
  export function free_session(session: number): void;
  export function set_text(session: number, text: string): void;
  export function parse_utf16(session: number): LeanTreeSitterParseResult;
}

