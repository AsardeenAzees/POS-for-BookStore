import { createContext, ReactNode, useContext, useState } from "react";

type Toast = { id: number; type: "success" | "error" | "info"; message: string };
const ToastContext = createContext<(toast: Omit<Toast, "id">) => void>(() => undefined);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  function push(toast: Omit<Toast, "id">) {
    const id = Date.now();
    setToasts((items) => [...items, { ...toast, id }]);
    window.setTimeout(() => setToasts((items) => items.filter((item) => item.id !== id)), 4200);
  }
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="toast-stack">{toasts.map((toast) => <div key={toast.id} className={`toast ${toast.type}`}>{toast.message}</div>)}</div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
