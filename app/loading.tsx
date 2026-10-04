export default function Loading() {
  return (
    <div aria-label="Loading workspace" aria-busy="true" className="space-y-6">
      <div className="skeleton h-5 w-32" />
      <div className="skeleton h-10 w-52" />
      <div className="skeleton h-5 w-96 max-w-full" />
      <div className="metrics-grid">
        {[1, 2, 3].map((n) => (
          <div className="skeleton h-36" key={n} />
        ))}
      </div>
      <div className="skeleton h-80" />
    </div>
  );
}
