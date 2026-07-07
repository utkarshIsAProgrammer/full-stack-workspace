interface ValidationMessageProps {
  message?: string | null;
  show?: boolean;
}

export default function ValidationMessage({ message }: ValidationMessageProps) {
  if (!message) return null;
  return (
    <p className="mt-1 px-4 text-[9px] font-bold text-red-400 leading-tight tracking-wide">
      {message}
    </p>
  );
}
