export type NoteSummary = {
  id?: string;
  title?: string;
  file?: string;
  tags?: string[];
  refs?: string[];
  backlinks?: string[];
};

export type SnippetSummary = {
  key?: string;
  name?: string;
  mode?: string;
  group?: string;
  body?: string;
  source?: string;
};

export type Inbound =
  | { type: "open"; file?: string; title?: string; content?: string; mode?: "markdown" | "source"; notes?: NoteSummary[]; snippets?: SnippetSummary[] }
  | { type: "saved"; ok?: boolean; message?: string; file?: string; notes?: NoteSummary[] }
  | { type: "notes"; notes?: NoteSummary[] }
  | { type: "snippets"; snippets?: SnippetSummary[] };
