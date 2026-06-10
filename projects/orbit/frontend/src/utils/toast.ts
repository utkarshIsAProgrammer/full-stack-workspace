export type ToastType = "success" | "error";

export function showToast(message: string, type: ToastType = "success") {
  window.dispatchEvent(
    new CustomEvent("showToast", {
      detail: { message, type },
    })
  );
}
