export default function Editor({ value, onChange, height }: { value: string; onChange: (v: string) => void; height: string }) {
  return <textarea aria-label="Code editor" style={{ height, width: '100%', fontFamily: 'monospace', fontSize: 14 }} value={value} onChange={(e) => onChange(e.target.value)} />;
}
