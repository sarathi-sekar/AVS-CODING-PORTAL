export type LanguageId = 'c' | 'cpp' | 'java' | 'python' | 'sql';

export interface LanguageInfo {
  id: LanguageId;
  label: string;
  monaco: string;
  /** Default Judge0 CE language id (v1.13). Override with JUDGE0_LANG_IDS if your instance differs. */
  judge0Id: number;
  starter: string;
}

export const LANGUAGES: Record<LanguageId, LanguageInfo> = {
  c: {
    id: 'c', label: 'C', monaco: 'c', judge0Id: 50,
    starter: '#include <stdio.h>\n\nint main(void) {\n    // write your code here\n    return 0;\n}\n',
  },
  cpp: {
    id: 'cpp', label: 'C++', monaco: 'cpp', judge0Id: 54,
    starter: '#include <iostream>\nusing namespace std;\n\nint main() {\n    // write your code here\n    return 0;\n}\n',
  },
  java: {
    id: 'java', label: 'Java', monaco: 'java', judge0Id: 62,
    starter: 'import java.util.*;\n\npublic class Main {\n    public static void main(String[] args) {\n        Scanner sc = new Scanner(System.in);\n        // write your code here\n    }\n}\n',
  },
  python: {
    id: 'python', label: 'Python', monaco: 'python', judge0Id: 71,
    starter: '# write your code here\n',
  },
  sql: {
    id: 'sql', label: 'SQL (SQLite)', monaco: 'sql', judge0Id: 82,
    starter: '-- write your query here\nSELECT 1;\n',
  },
};

export const LANGUAGE_IDS = Object.keys(LANGUAGES) as LanguageId[];
export function isLanguageId(v: unknown): v is LanguageId {
  return typeof v === 'string' && v in LANGUAGES;
}
