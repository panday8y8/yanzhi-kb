export function Spark({ values }: { values: number[] }) {
  const max = Math.max(...values, 1)
  return (
    <div className="spark" aria-hidden>
      {values.map((value, index) => (
        <span
          key={index}
          style={{
            height: `${Math.max(18, Math.round((value / max) * 100))}%`,
            opacity: 0.35 + (index / Math.max(1, values.length - 1)) * 0.55,
          }}
        />
      ))}
    </div>
  )
}
