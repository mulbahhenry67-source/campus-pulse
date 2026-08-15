export function CompatibilityRing({ score, size = 56 }: { score: number; size?: number }) {
  const stroke = size * 0.11;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  const color = score >= 80 ? "#3FB68B" : score >= 55 ? "#FFB454" : "#FF6B5B";

  return (
    <div className="relative" style={{ width: size, height: size }} role="img" aria-label={`${score}% compatible`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="#E5D8F6" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.6s ease" }}
        />
      </svg>
      <span
        className="absolute inset-0 flex items-center justify-center font-mono font-bold text-midnight dark:text-paper"
        style={{ fontSize: size * 0.24 }}
      >
        {score}
      </span>
    </div>
  );
}
