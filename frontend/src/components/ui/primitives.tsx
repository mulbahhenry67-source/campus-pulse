import { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "ghost" | "danger" }) {
  const styles: Record<string, string> = {
    primary: "bg-pulse-500 text-white hover:bg-pulse-600 shadow-pop",
    secondary: "bg-ember-500 text-white hover:bg-ember-700",
    ghost: "bg-transparent text-pulse-700 dark:text-pulse-200 hover:bg-pulse-50 dark:hover:bg-pulse-800",
    danger: "bg-white text-ember-700 border border-ember-300 hover:bg-ember-100",
  };
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-full px-5 py-2.5 font-semibold text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${styles[variant]} ${className}`}
      {...props}
    />
  );
}

export function TextField({
  label,
  error,
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; error?: string }) {
  const id = props.id ?? props.name;
  return (
    <div className={className}>
      <label htmlFor={id} className="block text-sm font-semibold text-pulse-800 dark:text-pulse-100 mb-1.5">
        {label}
      </label>
      <input
        id={id}
        className={`w-full rounded-xl border px-4 py-2.5 bg-white dark:bg-pulse-900 text-midnight dark:text-paper placeholder:text-pulse-300 ${
          error ? "border-ember-500" : "border-pulse-100 dark:border-pulse-700"
        }`}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="mt-1 text-xs text-ember-700">
          {error}
        </p>
      )}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`bg-white dark:bg-pulse-900 rounded-xl2 shadow-card ${className}`}>{children}</div>;
}

export function Badge({ children, tone = "pulse" }: { children: ReactNode; tone?: "pulse" | "meadow" | "sunbeam" | "ember" }) {
  const styles: Record<string, string> = {
    pulse: "bg-pulse-50 text-pulse-700 dark:bg-pulse-800 dark:text-pulse-100",
    meadow: "bg-meadow-100 text-meadow-700",
    sunbeam: "bg-sunbeam-300/40 text-sunbeam-700",
    ember: "bg-ember-100 text-ember-700",
  };
  return <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full ${styles[tone]}`}>{children}</span>;
}

export function ProgressBar({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex gap-1.5" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={total}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`h-1.5 flex-1 rounded-full transition-colors ${i < step ? "bg-ember-500" : "bg-pulse-100 dark:bg-pulse-800"}`}
        />
      ))}
    </div>
  );
}

export function Avatar({ url, name, size = 48, online }: { url: string | null; name: string; size?: number; online?: boolean }) {
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      {url ? (
        <img src={url} alt={name} className="w-full h-full rounded-full object-cover" />
      ) : (
        <div
          className="w-full h-full rounded-full bg-pulse-100 dark:bg-pulse-800 text-pulse-700 dark:text-pulse-100 flex items-center justify-center font-display font-semibold"
          style={{ fontSize: size * 0.4 }}
        >
          {name.charAt(0).toUpperCase()}
        </div>
      )}
      {online != null && (
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-white dark:border-midnight ${
            online ? "bg-meadow-500" : "bg-pulse-200 dark:bg-pulse-700"
          }`}
          aria-label={online ? "Online" : "Offline"}
        />
      )}
    </div>
  );
}
