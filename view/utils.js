import { Toast } from "bootstrap";

export function showToast(toastId) {
    var toast = new Toast(document.getElementById(toastId)).show();
}