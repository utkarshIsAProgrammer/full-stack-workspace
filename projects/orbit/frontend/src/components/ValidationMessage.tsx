interface ValidationMessageProps {
  message?: string | null;
  show?: boolean;
}

export default function ValidationMessage({ message }: ValidationMessageProps) {
  if (!message) return null;
  return (
    <p className="mt-1.5 px-4 text-[10px] font-semibold text-red-400 leading-tight">
      {message}
    </p>
  );
}
